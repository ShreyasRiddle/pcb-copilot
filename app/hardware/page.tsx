"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HardwareHubNav from "@/components/HardwareHubNav";
import { useCognitoAuth } from "@/hooks/useCognitoAuth";
import { stashHardwareHubPrefill } from "@/lib/hardwareHubPrefill";
import type { HardwareProjectMeta } from "@/lib/hardwareTypes";

export default function HardwareExplorePage() {
  const { getIdToken, configured } = useCognitoAuth();
  const router = useRouter();
  const [publicProjects, setPublicProjects] = useState<HardwareProjectMeta[]>([]);
  const [mine, setMine] = useState<HardwareProjectMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"stars" | "newest" | "title">("stars");

  const handleLoadDemo = useCallback(() => {
    stashHardwareHubPrefill({
      title: "TPS563201 Buck Converter — 12V → 5V 2A",
      description:
        "Synchronous step-down converter using TI TPS563201. 12V input, 5V/2A output at 500kHz. Includes input/output decoupling, bootstrap cap, and feedback divider.",
      readmeMarkdown:
        "## TPS563201 Buck Converter\n\n**Specs:** 12V → 5V, 2A, 500kHz\n\n### BOM\n| Ref | Value |\n|-----|-------|\n| U1 | TPS563201DDCR |\n| Cin | 10µF 25V |\n| Cout | 47µF 10V |\n| L1 | 4.7µH 3A |\n| R1 | 100kΩ |\n| R2 | 22.1kΩ |\n| Cboot | 100nF |\n",
    });
    router.push("/hardware/new?prefill=1");
  }, [router]);

  const filteredPublic = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...publicProjects];
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }
    if (sort === "stars") {
      list.sort((a, b) => {
        if (b.starCount !== a.starCount) return b.starCount - a.starCount;
        return b.createdAt.localeCompare(a.createdAt);
      });
    } else if (sort === "newest") {
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else {
      list.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
    }
    return list;
  }, [publicProjects, search, sort]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const pubRes = await fetch("/api/hardware/projects?scope=public");
        const pubData = (await pubRes.json()) as { projects?: HardwareProjectMeta[]; error?: string };
        if (!pubRes.ok) throw new Error(pubData.error ?? "Failed to load");
        if (!cancelled) setPublicProjects(pubData.projects ?? []);

        if (configured) {
          const token = await getIdToken();
          if (token) {
            const mineRes = await fetch("/api/hardware/projects?scope=mine", {
              headers: { Authorization: `Bearer ${token}` },
            });
            const mineData = (await mineRes.json()) as { projects?: HardwareProjectMeta[] };
            if (mineRes.ok && !cancelled) setMine(mineData.projects ?? []);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, getIdToken]);

  return (
    <>
      <HardwareHubNav />
      <main style={{ background: "var(--bg-base)", minHeight: "100vh", paddingTop: 52 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px 80px" }}>
          <header style={{ marginBottom: 36 }}>
            <p className="section-label" style={{ marginBottom: 8 }}>
              Open hardware
            </p>
            <h1
              style={{
                fontSize: "clamp(1.8rem, 4vw, 2.4rem)",
                fontFamily: "var(--font-space), system-ui, sans-serif",
                fontWeight: 700,
                color: "var(--text-1)",
                marginBottom: 12,
              }}
            >
              A GitHub for KiCad
            </h1>
            <p style={{ color: "var(--text-2)", maxWidth: 560, lineHeight: 1.6 }}>
              Upload KiCad project zips, get an AI-assisted BOM with distributor links, download the sources, and
              share builds under an SPDX license. Forks and stars work like you expect.
            </p>
            {process.env.NODE_ENV === "development" && (
              <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-3)" }}>
                <a
                  href="/api/hardware/diagnostics"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--accent)" }}
                >
                  AWS diagnostics (opens JSON)
                </a>
                {" · "}
                Set <code>ENABLE_HARDWARE_DIAGNOSTICS=1</code> to enable this URL outside dev.
              </p>
            )}
          </header>

          {/* ── Upload CTA ──────────────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
              padding: "20px 24px",
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              marginBottom: 36,
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: "var(--font-space), system-ui, sans-serif",
                  fontWeight: 600,
                  fontSize: 15,
                  color: "var(--text-1)",
                  marginBottom: 4,
                }}
              >
                Upload a KiCad schematic
              </p>
              <p style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.5, maxWidth: 400 }}>
                Zip your KiCad 6+ project and publish it. AI builds the BOM and wiring diagram automatically.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: "7px 14px", fontSize: 13 }}
                onClick={handleLoadDemo}
              >
                Load TPS563201 demo ↗
              </button>
              <Link
                href="/hardware/new"
                style={{
                  padding: "7px 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(110,231,247,0.35)",
                  background: "rgba(110,231,247,0.12)",
                  color: "var(--accent)",
                  fontWeight: 600,
                  fontSize: 13,
                  textDecoration: "none",
                  fontFamily: "var(--font-space), system-ui, sans-serif",
                }}
              >
                Upload project →
              </Link>
            </div>
          </div>

          {error && (
            <p style={{ color: "#f87171", marginBottom: 16, fontSize: 14 }}>
              {error}
              {error.includes("not configured") && (
                <span>
                  {" "}
                  Set <code style={{ color: "var(--accent)" }}>HARDWARE_TABLE_NAME</code> and{" "}
                  <code style={{ color: "var(--accent)" }}>HARDWARE_PROJECTS_BUCKET</code> in the server environment.
                </span>
              )}
            </p>
          )}

          {mine.length > 0 && (
            <section style={{ marginBottom: 40 }}>
              <h2 className="section-label" style={{ marginBottom: 14 }}>
                Your projects
              </h2>
              <div style={{ display: "grid", gap: 12 }}>
                {mine.map((p) => (
                  <ProjectCard key={p.projectId} project={p} />
                ))}
              </div>
            </section>
          )}

          <section>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
                marginBottom: 14,
                justifyContent: "space-between",
              }}
            >
              <h2 className="section-label" style={{ margin: 0 }}>
                Explore public
              </h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <input
                  type="search"
                  placeholder="Search title or description…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search public projects"
                  style={{
                    minWidth: 200,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-input)",
                    color: "var(--text-1)",
                    fontSize: 13,
                  }}
                />
                <label style={{ fontSize: 12, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 6 }}>
                  Sort
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as "stars" | "newest" | "title")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--bg-input)",
                      color: "var(--text-1)",
                      fontSize: 13,
                    }}
                  >
                    <option value="stars">Most stars</option>
                    <option value="newest">Newest</option>
                    <option value="title">Title A–Z</option>
                  </select>
                </label>
              </div>
            </div>
            {loading && <p style={{ color: "var(--text-3)" }}>Loading…</p>}
            {!loading && publicProjects.length === 0 && (
              <p style={{ color: "var(--text-3)" }}>No public projects yet. Be the first to publish one.</p>
            )}
            {!loading && publicProjects.length > 0 && filteredPublic.length === 0 && (
              <p style={{ color: "var(--text-3)" }}>No projects match your search.</p>
            )}
            <div style={{ display: "grid", gap: 12 }}>
              {filteredPublic.map((p) => (
                <ProjectCard key={p.projectId} project={p} />
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function ProjectCard({ project }: { project: HardwareProjectMeta }) {
  return (
    <Link
      href={`/hardware/${project.projectId}`}
      style={{
        display: "block",
        padding: 16,
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--bg-card)",
        textDecoration: "none",
        color: "var(--text-1)",
        transition: "border-color 150ms ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{project.title}</div>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            {project.licenseSpdx} · {project.starCount} stars · {project.forkCount} forks
          </div>
        </div>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
          {new Date(project.createdAt).toLocaleDateString()}
        </span>
      </div>
      {project.description ? (
        <p style={{ marginTop: 10, fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>{project.description}</p>
      ) : null}
    </Link>
  );
}
