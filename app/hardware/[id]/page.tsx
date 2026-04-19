"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import HardwareHubNav from "@/components/HardwareHubNav";
import WiringDiagram from "@/components/WiringDiagram";
import BomTable from "@/components/BomTable";
import { useCognitoAuth } from "@/hooks/useCognitoAuth";
import { decodeJwtSub } from "@/lib/decodeJwtSub";
import type {
  EnrichedBomLine,
  HardwareComment,
  HardwareProjectMeta,
  HardwareRevision,
  RawBomLine,
} from "@/lib/hardwareTypes";
import type { ComponentNode } from "@/lib/types";

type Tab = "overview" | "wiring" | "bom" | "comments" | "files" | "build" | "license";

export default function HardwareProjectDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { getIdToken, configured } = useCognitoAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [project, setProject] = useState<HardwareProjectMeta | null>(null);
  const [revision, setRevision] = useState<HardwareRevision | null>(null);
  const [starred, setStarred] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [highlightedEdgeId, setHighlightedEdgeId] = useState<string | null>(null);
  const [comments, setComments] = useState<HardwareComment[]>([]);
  const [mySub, setMySub] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);

  const handleNodeHover = useCallback((node: ComponentNode | null) => {
    setHoveredNodeId(node?.id ?? null);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const token = configured ? await getIdToken() : null;
      const res = await fetch(`/api/hardware/projects/${encodeURIComponent(id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = (await res.json()) as {
        project?: HardwareProjectMeta;
        revision?: HardwareRevision | null;
        starred?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Not found");
      setProject(data.project ?? null);
      setRevision(data.revision ?? null);
      setStarred(data.starred ?? false);

      const cr = await fetch(`/api/hardware/projects/${encodeURIComponent(id)}/comments`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const cd = (await cr.json()) as { comments?: HardwareComment[] };
      setComments(Array.isArray(cd.comments) ? cd.comments : []);
      if (token) setMySub(decodeJwtSub(token));
      else setMySub(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [configured, getIdToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownload = async () => {
    const token = await getIdToken();
    const res = await fetch(`/api/hardware/projects/${encodeURIComponent(id)}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = (await res.json()) as { url?: string; filename?: string; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Download failed");
    if (data.url) {
      window.open(data.url, "_blank", "noopener,noreferrer");
    }
  };

  const handleStar = async () => {
    const token = await getIdToken();
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/hardware/projects/${encodeURIComponent(id)}/star`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ star: !starred }),
      });
      const data = (await res.json()) as { starred?: boolean; starCount?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Star failed");
      setStarred(data.starred ?? !starred);
      if (project && data.starCount !== undefined) {
        setProject({ ...project, starCount: data.starCount });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Star failed");
    } finally {
      setBusy(false);
    }
  };

  const handleFork = async () => {
    const token = await getIdToken();
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/hardware/projects/${encodeURIComponent(id)}/fork`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Fork failed");
      if (data.id) window.location.href = `/hardware/${data.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fork failed");
    } finally {
      setBusy(false);
    }
  };

  const authorLabel = (c: HardwareComment) => {
    if (mySub && c.authorSub === mySub) return "You";
    const s = c.authorSub;
    if (s.length <= 8) return `User ${s}`;
    return `User …${s.slice(-6)}`;
  };

  const handlePostComment = async () => {
    const text = commentDraft.trim();
    if (!text || !configured) return;
    const token = await getIdToken();
    if (!token) return;
    setCommentBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/hardware/projects/${encodeURIComponent(id)}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as { comment?: HardwareComment; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Post failed");
      if (data.comment) {
        setComments((prev) => [data.comment!, ...prev]);
        setCommentDraft("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comment failed");
    } finally {
      setCommentBusy(false);
    }
  };

  const downloadBomCsv = () => {
    const rows: (RawBomLine & Partial<EnrichedBomLine>)[] =
      revision?.bomEnriched?.length ? revision.bomEnriched : revision?.bomRaw ?? [];
    const header = [
      "Reference",
      "Value",
      "Footprint",
      "Qty",
      "MPN",
      "Price",
      "Distributor",
      "URL",
    ];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          csvEscape(r.reference),
          csvEscape(r.value),
          csvEscape(r.footprint),
          String(r.quantity ?? 1),
          csvEscape(r.partNumber ?? ""),
          csvEscape(r.price ?? ""),
          csvEscape(r.distributor ?? ""),
          csvEscape(r.url ?? ""),
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.title.replace(/[^a-z0-9-_]+/gi, "_") ?? "bom"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <HardwareHubNav />
      <main style={{ background: "var(--bg-base)", minHeight: "100vh", paddingTop: 52 }}>
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "40px 24px 80px" }}>
          {loading && <p style={{ color: "var(--text-3)" }}>Loading…</p>}
          {error && !project && <p style={{ color: "#f87171" }}>{error}</p>}
          {project && (
            <>
              <div style={{ marginBottom: 24 }}>
                <p className="section-label" style={{ marginBottom: 6 }}>
                  {project.visibility} · {project.licenseSpdx}
                </p>
                <h1
                  style={{
                    fontSize: "clamp(1.5rem, 3vw, 2rem)",
                    fontFamily: "var(--font-space), system-ui, sans-serif",
                    fontWeight: 700,
                    color: "var(--text-1)",
                    marginBottom: 8,
                  }}
                >
                  {project.title}
                </h1>
                <p style={{ color: "var(--text-2)", fontSize: 14, lineHeight: 1.6 }}>{project.description}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                  {configured && (
                    <>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ padding: "8px 14px", fontSize: 13 }}
                        disabled={busy}
                        onClick={() => void handleStar()}
                      >
                        {starred ? "Unstar" : "Star"} ({project.starCount})
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ padding: "8px 14px", fontSize: 13 }}
                        disabled={busy}
                        onClick={() => void handleFork()}
                      >
                        Fork ({project.forkCount})
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: "8px 14px", fontSize: 13 }}
                    onClick={() => void handleDownload().catch((e) => setError(String(e)))}
                  >
                    {revision?.sourceKind === "skidl_py" ? "Download .py" : "Download zip"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: "8px 14px", fontSize: 13 }}
                    onClick={downloadBomCsv}
                    disabled={!revision?.bomRaw?.length && !revision?.bomEnriched?.length}
                  >
                    Export BOM CSV
                  </button>
                </div>
                {project.forkedFromProjectId && (
                  <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-3)" }}>
                    Forked from{" "}
                    <a href={`/hardware/${project.forkedFromProjectId}`} style={{ color: "var(--accent)" }}>
                      parent project
                    </a>
                  </p>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 4,
                  borderBottom: "1px solid var(--border)",
                  marginBottom: 20,
                  flexWrap: "wrap",
                }}
              >
                {(
                  [
                    ["overview", "Overview"],
                    ["wiring", "Wiring"],
                    ["bom", "BOM"],
                    ["comments", "Comments"],
                    ["files", "Files"],
                    ["build", "Build"],
                    ["license", "License"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    style={{
                      padding: "10px 14px",
                      fontSize: 13,
                      border: "none",
                      background: "none",
                      color: tab === k ? "var(--accent)" : "var(--text-2)",
                      borderBottom: tab === k ? "2px solid var(--accent)" : "2px solid transparent",
                      marginBottom: -1,
                      cursor: "pointer",
                      fontFamily: "var(--font-space), system-ui, sans-serif",
                      fontWeight: tab === k ? 600 : 500,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "wiring" && (
                <div>
                  {!revision?.wiringGraph?.nodes?.length ? (
                    <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.7 }}>
                      No wiring diagram for this revision yet. Upload a KiCad zip with a{" "}
                      <code style={{ color: "var(--accent)" }}>.kicad_sch</code> and finalize again. Connection
                      lines are inferred when <code style={{ color: "var(--accent)" }}>GEMINI_API_KEY</code> is set
                      on the server; without it you still get component blocks from the BOM.
                    </p>
                  ) : (
                    <div>
                      <p
                        style={{
                          fontSize: 12,
                          color: "var(--text-3)",
                          marginBottom: 14,
                          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                        }}
                      >
                        Hover a component to trace its connections · click an edge to highlight it
                      </p>
                      <WiringDiagram
                        wiringGraph={revision.wiringGraph}
                        hoveredNodeId={hoveredNodeId}
                        highlightedEdgeId={highlightedEdgeId}
                        onNodeHover={handleNodeHover}
                        onNodeClick={() => {}}
                        onEdgeHighlight={setHighlightedEdgeId}
                      />
                    </div>
                  )}
                </div>
              )}

              {tab === "overview" && (
                <div style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.7 }}>
                  {project.readmeMarkdown ? (
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        fontFamily: "var(--font-geist-sans), system-ui",
                        background: "var(--bg-card)",
                        padding: 16,
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                      }}
                    >
                      {project.readmeMarkdown}
                    </pre>
                  ) : (
                    <p>No README text stored on the project. Add README markdown when creating a project, or include README.md in the zip.</p>
                  )}
                  {revision?.analysisError && (
                    <p style={{ marginTop: 16, color: "#fbbf24", fontSize: 13 }}>
                      Analysis note: {revision.analysisError}
                    </p>
                  )}
                </div>
              )}

              {tab === "comments" && (
                <div>
                  <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>
                    Discussion for this project. Sign in to post.
                  </p>
                  {configured ? (
                    <div style={{ marginBottom: 20 }}>
                      <textarea
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder="Write a comment…"
                        rows={4}
                        style={{
                          width: "100%",
                          padding: 12,
                          borderRadius: 10,
                          border: "1px solid var(--border)",
                          background: "var(--bg-input)",
                          color: "var(--text-1)",
                          fontSize: 14,
                          resize: "vertical",
                          marginBottom: 10,
                        }}
                      />
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ padding: "8px 16px", fontSize: 13 }}
                        disabled={commentBusy || !commentDraft.trim()}
                        onClick={() => void handlePostComment()}
                      >
                        {commentBusy ? "Posting…" : "Post comment"}
                      </button>
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 20 }}>
                      Sign in to join the conversation.
                    </p>
                  )}
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {comments.map((c) => (
                      <li
                        key={c.commentId}
                        style={{
                          padding: "14px 0",
                          borderBottom: "1px solid var(--border)",
                          fontSize: 14,
                          color: "var(--text-2)",
                          lineHeight: 1.55,
                        }}
                      >
                        <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 6 }}>
                          <strong style={{ color: "var(--text-1)" }}>{authorLabel(c)}</strong>
                          {" · "}
                          {new Date(c.createdAt).toLocaleString()}
                        </div>
                        <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
                      </li>
                    ))}
                  </ul>
                  {comments.length === 0 && (
                    <p style={{ fontSize: 13, color: "var(--text-3)" }}>No comments yet.</p>
                  )}
                </div>
              )}

              {tab === "bom" && (
                <div>
                  <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 12 }}>
                    Sourced from schematic symbols. Verify parts against your footprints and lifecycle.
                  </p>
                  {revision?.wiringGraph?.nodes?.length ? (
                    <BomTable nodes={revision.wiringGraph.nodes} />
                  ) : (
                    <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
                      No BOM table yet for this revision. Upload a KiCad zip with a{" "}
                      <code style={{ color: "var(--accent)" }}>.kicad_sch</code> and finalize again to generate the
                      wiring graph nodes.
                    </p>
                  )}
                </div>
              )}

              {tab === "files" && (
                <div>
                  <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 12 }}>
                    SHA-256: <code style={{ color: "var(--accent)" }}>{revision?.sha256 ?? "—"}</code> · Size:{" "}
                    {revision ? `${(revision.sizeBytes / 1024).toFixed(1)} KB` : "—"}
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13 }}>
                    {(revision?.fileManifest ?? []).map((f) => (
                      <li
                        key={f}
                        style={{
                          padding: "6px 0",
                          borderBottom: "1px solid var(--border)",
                          color: "var(--text-2)",
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tab === "build" && (
                <div style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.7 }}>
                  <p style={{ marginBottom: 16 }}>
                    Export Gerbers from KiCad (File → Fabrication Outputs → Gerbers), then upload to a fab. These
                    links open the vendor order flows (you still upload your own gerbers).
                  </p>
                  {revision?.pcbStats && (
                    <ul style={{ marginBottom: 20 }}>
                      {revision.pcbStats.copperLayers != null && (
                        <li>Copper layers (from file heuristic): {revision.pcbStats.copperLayers}</li>
                      )}
                      {revision.pcbStats.widthMm != null && revision.pcbStats.heightMm != null && (
                        <li>
                          Approx outline (heuristic): {revision.pcbStats.widthMm.toFixed(1)} ×{" "}
                          {revision.pcbStats.heightMm.toFixed(1)} mm
                        </li>
                      )}
                    </ul>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    <a
                      href="https://jlcpcb.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost"
                      style={{ padding: "10px 16px", textDecoration: "none" }}
                    >
                      JLCPCB ↗
                    </a>
                    <a
                      href="https://www.pcbway.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost"
                      style={{ padding: "10px 16px", textDecoration: "none" }}
                    >
                      PCBWay ↗
                    </a>
                    <a
                      href="https://oshpark.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost"
                      style={{ padding: "10px 16px", textDecoration: "none" }}
                    >
                      OSH Park ↗
                    </a>
                  </div>
                </div>
              )}

              {tab === "license" && (
                <div style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.7 }}>
                  <p>
                    SPDX: <strong style={{ color: "var(--text-1)" }}>{project.licenseSpdx}</strong>
                  </p>
                  <p style={{ marginTop: 12 }}>
                    See{" "}
                    <a href="https://spdx.org/licenses/" style={{ color: "var(--accent)" }} target="_blank" rel="noreferrer">
                      SPDX license list
                    </a>
                    . You are responsible for choosing a license that matches how you want others to use your
                    design files.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
