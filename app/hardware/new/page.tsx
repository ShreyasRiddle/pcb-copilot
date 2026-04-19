"use client";

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HardwareHubNav from "@/components/HardwareHubNav";
import { useCognitoAuth } from "@/hooks/useCognitoAuth";
import { consumeHardwareHubPrefill } from "@/lib/hardwareHubPrefill";
import { COMMON_LICENSES } from "@/lib/hardwareTypes";
import type { HardwareRevision, HardwareVisibility } from "@/lib/hardwareTypes";

async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Route handlers should return JSON; HTML usually means a proxy error, 502, or Next error page. */
async function readJsonBody<T>(res: Response, step: string): Promise<T> {
  const text = await res.text();
  const trimmed = text.trimStart();
  const head = trimmed.slice(0, 32).toLowerCase();
  if (head.startsWith("<!doctype") || head.startsWith("<html")) {
    throw new Error(
      `${step}: received a web page instead of JSON (HTTP ${res.status}). Check server logs, deployment limits, or try again.`
    );
  }
  if (!trimmed) {
    throw new Error(`${step}: empty response (HTTP ${res.status}).`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = trimmed.slice(0, 160).replace(/\s+/g, " ");
    throw new Error(
      `${step}: response was not JSON (HTTP ${res.status}). ${snippet}${trimmed.length > 160 ? "…" : ""}`
    );
  }
}

function formatS3UploadError(res: Response, bodyText: string): string {
  const t = bodyText.trim();
  if (t.startsWith("<?xml") || t.includes("<Error>") || t.includes("</Error>")) {
    return `S3 rejected the upload (HTTP ${res.status}). Check bucket CORS, object size limits, and that the presigned URL has not expired.`;
  }
  if (!t) return `S3 upload failed (HTTP ${res.status}).`;
  return `S3 upload failed (HTTP ${res.status}). ${t.slice(0, 200)}${t.length > 200 ? "…" : ""}`;
}

const UPLOAD_STEPS = [
  { phase: "preview" as const, label: "Validate zip locally" },
  { phase: "create" as const, label: "Create project" },
  { phase: "presign" as const, label: "Request upload URL" },
  { phase: "s3" as const, label: "Upload zip to storage" },
  {
    phase: "finalize" as const,
    label: "Analyze and save (read schematics from zip, BOM + wiring diagram)",
  },
] as const;

type UploadPhase = "idle" | (typeof UPLOAD_STEPS)[number]["phase"];

type HubStatusPayload = {
  cognitoConfigured: boolean;
  dynamoConfigured: boolean;
  s3Configured: boolean;
  uploadPipelineReady: boolean;
};

export default function NewHardwareProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getIdToken, configured, email } = useCognitoAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [readmeMarkdown, setReadmeMarkdown] = useState("");
  const [licenseSpdx, setLicenseSpdx] = useState("MIT");
  const [visibility, setVisibility] = useState<HardwareVisibility>("private");
  const [rights, setRights] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hubStatus, setHubStatus] = useState<HubStatusPayload | null>(null);

  const busy = uploadPhase !== "idle";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/hardware/hub-status");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as HubStatusPayload;
        if (!cancelled) setHubStatus(data);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (searchParams.get("prefill") !== "1") return;
    const data = consumeHardwareHubPrefill();
    if (!data) return;
    setTitle((t) => t.trim() || data.title);
    setDescription((d) => d.trim() || data.description);
    setReadmeMarkdown((r) => r.trim() || data.readmeMarkdown);
    router.replace("/hardware/new", { scroll: false });
  }, [searchParams, router]);

  const submit = async () => {
    setError(null);
    if (!configured || !email) {
      setError("Sign in to create a project.");
      return;
    }
    if (!rights) {
      setError("Confirm that you have the right to share these files.");
      return;
    }
    if (!file?.name.toLowerCase().endsWith(".zip")) {
      setError("Upload a .zip containing your KiCad 6+ project (.kicad_pro, .kicad_sch, …).");
      return;
    }
    if (visibility === "public" && !licenseSpdx.trim()) {
      setError("Choose a license for public projects.");
      return;
    }

    const token = await getIdToken();
    if (!token) {
      setError("Could not read session — try signing in again.");
      return;
    }

    setUploadPhase("preview");
    try {
      const previewFd = new FormData();
      previewFd.append("file", file);
      const previewRes = await fetch("/api/hardware/preview-zip", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: previewFd,
      });
      const previewData = await readJsonBody<{
        ok?: boolean;
        message?: string;
        error?: string;
        bomLineCount?: number;
        schematicFileCount?: number;
      }>(previewRes, "Schematic preview");
      if (!previewRes.ok) {
        throw new Error(previewData.error ?? previewData.message ?? "Schematic check failed");
      }
      if (!previewData.ok) {
        throw new Error(
          previewData.message ??
            "Zip must contain .kicad_sch files with symbols so we can build a BOM and wiring diagram."
        );
      }

      setUploadPhase("create");
      const createRes = await fetch("/api/hardware/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          readmeMarkdown,
          licenseSpdx,
          visibility,
        }),
      });
      const createData = await readJsonBody<{ id?: string; error?: string }>(
        createRes,
        "Create project"
      );
      if (!createRes.ok) throw new Error(createData.error ?? "Create failed");
      const projectId = createData.id;
      if (!projectId) throw new Error("No project id");

      setUploadPhase("presign");
      const upRes = await fetch(`/api/hardware/projects/${encodeURIComponent(projectId)}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const upData = await readJsonBody<{
        revisionId?: string;
        uploadUrl?: string;
        error?: string;
      }>(upRes, "Upload URL");
      if (!upRes.ok) throw new Error(upData.error ?? "Upload URL failed");
      const { revisionId, uploadUrl } = upData;
      if (!revisionId || !uploadUrl) throw new Error("Invalid upload response");

      setUploadPhase("s3");
      const buf = await file.arrayBuffer();
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: buf,
        headers: { "Content-Type": "application/zip" },
      });
      if (!putRes.ok) {
        const putBody = await putRes.text();
        throw new Error(formatS3UploadError(putRes, putBody));
      }

      setUploadPhase("finalize");
      const sha = await sha256Hex(file);
      const finalizeMs = 270_000;
      let finRes: Response;
      try {
        finRes = await fetch(
          `/api/hardware/projects/${encodeURIComponent(projectId)}/revisions/${encodeURIComponent(revisionId)}/finalize`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              sizeBytes: file.size,
              sha256: sha,
            }),
            signal: AbortSignal.timeout(finalizeMs),
          }
        );
      } catch (e) {
        if (e instanceof DOMException && e.name === "TimeoutError") {
          throw new Error(
            `Finalize timed out after ${Math.round(finalizeMs / 1000)}s. Large projects with distributor sourcing enabled (HARDWARE_FINALIZE_BOM_SOURCING=1) can exceed this—try again or increase server maxDuration.`
          );
        }
        throw e;
      }
      const finData = await readJsonBody<{
        revision?: HardwareRevision;
        error?: string;
      }>(finRes, "Finalize");
      if (!finRes.ok) throw new Error(finData.error ?? "Finalize failed");

      const rev = finData.revision;
      if (
        !rev ||
        rev.analysisStatus !== "complete" ||
        !rev.wiringGraph?.nodes?.length
      ) {
        throw new Error(
          rev?.analysisError ??
            "Analysis did not produce a complete BOM and wiring diagram. Open the project from Hardware hub to inspect, or upload a different zip."
        );
      }

      router.push(`/hardware/${projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setUploadPhase("idle");
    }
  };

  return (
    <>
      <HardwareHubNav />
      <main style={{ background: "var(--bg-base)", minHeight: "100vh", paddingTop: 52 }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 24px 80px" }}>
          {hubStatus && !hubStatus.uploadPipelineReady ? (
            <div
              role="alert"
              style={{
                marginBottom: 24,
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid rgba(245,158,11,0.35)",
                background: "rgba(245,158,11,0.08)",
                color: "#fbbf24",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              <strong style={{ display: "block", marginBottom: 6 }}>Zip uploads are not available</strong>
              {!hubStatus.cognitoConfigured ? (
                <span>Sign-in is not configured on this server.</span>
              ) : !hubStatus.dynamoConfigured ? (
                <span>
                  Hardware hub database is not configured. Set HARDWARE_TABLE_NAME and AWS credentials for DynamoDB.
                </span>
              ) : !hubStatus.s3Configured ? (
                <span>
                  S3 is not configured. Set HARDWARE_PROJECTS_BUCKET and grant the server access to that bucket before
                  uploading projects.
                </span>
              ) : (
                <span>Hardware hub is not ready for uploads.</span>
              )}
            </div>
          ) : null}

          <h1
            style={{
              fontSize: 24,
              fontFamily: "var(--font-space), system-ui, sans-serif",
              fontWeight: 700,
              color: "var(--text-1)",
              marginBottom: 8,
            }}
          >
            New hardware project
          </h1>
          <p style={{ color: "var(--text-2)", marginBottom: 28, fontSize: 14, lineHeight: 1.6 }}>
            Zip your KiCad project (v6+). We first run a quick local check on your zip (symbols and a
            component layout from the schematic BOM). After upload, the server reads your zip from storage,
            finds <code>.kicad_sch</code> files, builds the BOM and wiring diagram (net inference when Gemini
            is configured). Optional per-line distributor sourcing during finalize is off by default for speed
            (see <code>HARDWARE_FINALIZE_BOM_SOURCING</code> in <code>.env.example</code>).{" "}
            <code>.kicad_pcb</code> is optional for board hints.
            Max zip size for preview: 50&nbsp;MB.
          </p>

          {busy ? (
            <div style={{ marginBottom: 22 }}>
              <p
                role="status"
                aria-live="polite"
                aria-atomic="true"
                style={{
                  fontSize: 13,
                  color: "var(--text-2)",
                  marginBottom: 12,
                  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                }}
              >
                Step{" "}
                {UPLOAD_STEPS.findIndex((s) => s.phase === uploadPhase) + 1}{" "}
                of {UPLOAD_STEPS.length}:{" "}
                {UPLOAD_STEPS.find((s) => s.phase === uploadPhase)?.label ?? ""}
              </p>
              <ol
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {UPLOAD_STEPS.map((step, i) => {
                  const activeIdx = UPLOAD_STEPS.findIndex((s) => s.phase === uploadPhase);
                  const done = activeIdx > i;
                  const active = activeIdx === i;
                  return (
                    <li
                      key={step.phase}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        fontSize: 13,
                        color: done ? "var(--text-3)" : active ? "var(--accent)" : "var(--text-2)",
                        fontWeight: active ? 600 : 400,
                        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                      }}
                    >
                      <span aria-hidden style={{ width: 18, flexShrink: 0, textAlign: "center" }}>
                        {done ? "✓" : active ? "→" : `${i + 1}.`}
                      </span>
                      <span>{step.label}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}

          <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 6 }}>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
            placeholder="e.g. USB-C PD breakout"
          />

          <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", margin: "16px 0 6px" }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
            placeholder="What does this board do?"
          />

          <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", margin: "16px 0 6px" }}>
            README (markdown, optional)
          </label>
          <textarea
            value={readmeMarkdown}
            onChange={(e) => setReadmeMarkdown(e.target.value)}
            style={{ ...inputStyle, minHeight: 100, resize: "vertical", fontFamily: "ui-monospace, monospace" }}
            placeholder="# Build notes&#10;…"
          />

          <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", margin: "16px 0 6px" }}>
            License (SPDX)
          </label>
          <select
            value={licenseSpdx}
            onChange={(e) => setLicenseSpdx(e.target.value)}
            style={inputStyle}
          >
            {COMMON_LICENSES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>

          <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", margin: "16px 0 6px" }}>
            Visibility
          </label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as HardwareVisibility)}
            style={inputStyle}
          >
            <option value="private">Private (only you)</option>
            <option value="unlisted">Unlisted (anyone with the link)</option>
            <option value="public">Public (listed in Explore)</option>
          </select>

          <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", margin: "16px 0 6px" }}>
            KiCad project (.zip)
          </label>
          <input
            type="file"
            accept=".zip,application/zip"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: 13, color: "var(--text-2)" }}
          />

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 20, cursor: "pointer" }}>
            <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />
            <span style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
              I have the right to share these files under the chosen license, and I understand AI-sourced BOM links
              are not guaranteed.
            </span>
          </label>

          {error && <p style={{ color: "#f87171", marginTop: 16, fontSize: 13 }}>{error}</p>}

          <button
            type="button"
            disabled={busy || (hubStatus !== null && !hubStatus.uploadPipelineReady)}
            aria-busy={busy}
            onClick={() => void submit()}
            style={{
              marginTop: 24,
              padding: "12px 20px",
              borderRadius: 10,
              border: "1px solid rgba(110,231,247,0.35)",
              background: "rgba(110,231,247,0.12)",
              color: "var(--accent)",
              fontWeight: 600,
              cursor: busy ? "wait" : hubStatus && !hubStatus.uploadPipelineReady ? "not-allowed" : "pointer",
              fontSize: 14,
              fontFamily: "var(--font-space), system-ui, sans-serif",
            }}
          >
            {busy ? "Working…" : "Create & upload"}
          </button>
        </div>
      </main>
    </>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-input)",
  color: "var(--text-1)",
  fontSize: 14,
};
