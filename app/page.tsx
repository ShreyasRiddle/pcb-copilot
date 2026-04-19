"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useMemo } from "react";
import { ComponentNode, WiringGraph } from "@/lib/types";
import {
  listCircuitRunHistory,
  subscribeCircuitRunHistory,
  type CircuitRunHistoryEntry,
} from "@/lib/circuitRunHistory";
import { buildHardwareHubPrefill, stashHardwareHubPrefill } from "@/lib/hardwareHubPrefill";
import { useCircuitPipeline } from "@/hooks/useCircuitPipeline";
import { useCognitoAuth } from "@/hooks/useCognitoAuth";
import CircuitHistorySidebar, {
  CIRCUIT_HISTORY_RAIL_WIDTH_PX,
} from "@/components/CircuitHistorySidebar";
import InputForm from "@/components/InputForm";
import WiringDiagram from "@/components/WiringDiagram";
import BomTable from "@/components/BomTable";
import SourcingPanel from "@/components/SourcingPanel";
import StatusBar from "@/components/StatusBar";
import ClarificationCard from "@/components/ClarificationCard";
import AuthControls from "@/components/AuthControls";
import SaveDesignDialog from "@/components/SaveDesignDialog";
import SavedDesignsModal from "@/components/SavedDesignsModal";

export default function Home() {
  const router = useRouter();
  const [historyTick, setHistoryTick] = useState(0);
  const [wideLayout, setWideLayout] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 960px)");
    const sync = () => setWideLayout(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    return subscribeCircuitRunHistory(() => setHistoryTick((t) => t + 1));
  }, []);

  const historyEntries = useMemo(() => listCircuitRunHistory(), [historyTick]);

  const [selectedNode, setSelectedNode] = useState<ComponentNode | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [highlightedEdgeId, setHighlightedEdgeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"bom" | "diagram">("diagram");
  const [skidlState, setSkidlState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [skidlMsg, setSkidlMsg] = useState<string>("");
  const [skidlNetlist, setSkidlNetlist] = useState<string | null>(null);
  const [skidlScript, setSkidlScript] = useState<string | null>(null);

  const {
    loading,
    status,
    step,
    wiringGraph,
    lastPrompt,
    hasResult,
    isDemo,
    clarificationQuestions,
    run,
    runWithAnswers,
    loadDesign,
  } = useCircuitPipeline();

  const { getIdToken, configured, email } = useCognitoAuth();
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);

  const handleLoadSaved = useCallback(
    (graph: WiringGraph, prompt: string) => {
      setSelectedNode(null);
      setHighlightedEdgeId(null);
      setHoveredNodeId(null);
      setSkidlState("idle");
      setSkidlMsg("");
      setSkidlNetlist(null);
      setSkidlScript(null);
      loadDesign(graph, { prompt });
    },
    [loadDesign]
  );

  const handleHistorySelect = useCallback(
    (entry: CircuitRunHistoryEntry) => {
      handleLoadSaved(entry.wiringGraph, entry.prompt);
    },
    [handleLoadSaved]
  );

  const handlePublishToHub = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    if (!wiringGraph?.nodes?.length) return;

    // Ensure we have a SKiDL script to publish (best-effort: generate if missing).
    const ensureScript = async (): Promise<string> => {
      if (skidlScript?.trim()) return skidlScript;
      const res = await fetch("/api/export-skidl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wiringGraph }),
      });
      if (!res.ok || !res.body) throw new Error(`SKiDL export failed (HTTP ${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let script = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const event = JSON.parse(raw) as { type?: string; script?: string; error?: string };
            if (event.type === "result") {
              if (event.error) throw new Error(event.error);
              script = event.script ?? "";
            }
          } catch {
            // ignore
          }
        }
      }
      if (!script.trim()) throw new Error("SKiDL export returned an empty script");
      setSkidlScript(script);
      return script;
    };

    const script = await ensureScript();
    const prefill = buildHardwareHubPrefill(lastPrompt);

    const res = await fetch("/api/hardware/publish-skidl", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: prefill.title,
        description: prefill.description,
        readmeMarkdown: prefill.readmeMarkdown,
        licenseSpdx: "MIT",
        visibility: "private",
        wiringGraph,
        skidlPy: script,
      }),
    });

    const data = (await res.json()) as { projectId?: string; error?: string };
    if (!res.ok || !data.projectId) throw new Error(data.error ?? "Publish failed");
    router.push(`/hardware/${data.projectId}`);
  }, [getIdToken, lastPrompt, router, skidlScript, wiringGraph]);

  const canPublishHub = Boolean(configured && email);

  const handleRun = useCallback(
    (prompt: string, pdfBase64?: string) => {
      run(prompt, { vin: "", vout: "", iout: "" }, pdfBase64);
    },
    [run]
  );

  const handleNodeHover = useCallback((node: ComponentNode | null) => {
    setHoveredNodeId(node?.id ?? null);
  }, []);

  const handleBomDownload = useCallback(async () => {
    try {
      const res = await fetch("/api/export-bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wiringGraph }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bom.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent fail
    }
  }, [wiringGraph]);

  const downloadBlob = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSkidlExport = useCallback(async () => {
    if (skidlState === "loading") return;
    setSkidlState("loading");
    setSkidlMsg("Generating SKiDL script…");
    setSkidlNetlist(null);

    try {
      const res = await fetch("/api/export-skidl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wiringGraph }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let gotResult = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;

          try {
            const event = JSON.parse(raw) as {
              type: string;
              message?: string;
              script?: string;
              netlist?: string;
              error?: string;
            };

            if (event.type === "status" && event.message) {
              setSkidlMsg(event.message);
            } else if (event.type === "result") {
              gotResult = true;

              if (event.script) {
                setSkidlScript(event.script);
                downloadBlob(event.script, "circuit_skidl.py", "text/x-python");
              }

              if (event.netlist) {
                const netBytes = atob(event.netlist);
                setSkidlNetlist(netBytes);
              }

              if (event.error) {
                setSkidlMsg(event.error);
                setSkidlState("error");
              } else {
                setSkidlMsg(event.netlist ? "ERC passed — .py + .net downloaded" : "Script downloaded");
                setSkidlState("done");
              }
            }
          } catch {
            // non-JSON line
          }
        }
      }

      if (!gotResult) {
        setSkidlState("error");
        setSkidlMsg("Export failed — check console.");
      }
    } catch (err) {
      setSkidlState("error");
      setSkidlMsg(err instanceof Error ? err.message : "Export failed");
    }
  }, [wiringGraph, skidlState]);

  const handleSkidlNetlistDownload = useCallback(() => {
    if (skidlNetlist) {
      downloadBlob(skidlNetlist, "circuit.net", "application/xml");
    }
  }, [skidlNetlist]);

  return (
    <>
      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 52,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          background: "rgba(13, 13, 18, 0.8)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width={22} height={22} viewBox="0 0 28 28" fill="none">
            <rect width={28} height={28} rx={7} fill="rgba(110,231,247,0.15)" />
            <path
              d="M7 14h4M17 14h4M14 7v4M14 17v4"
              stroke="#6ee7f7"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <circle cx={14} cy={14} r={3} fill="#6ee7f7" fillOpacity={0.35} stroke="#6ee7f7" strokeWidth={1.5} />
          </svg>
          <span
            style={{
              fontFamily: "var(--font-space), system-ui, sans-serif",
              fontWeight: 600,
              fontSize: 15,
              letterSpacing: "-0.02em",
              color: "var(--text-1)",
            }}
          >
            PCB Copilot
          </span>
        </div>

        {/* Auth + links */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <AuthControls />
          <Link
            href="/hardware"
            className="btn-ghost"
            style={{ padding: "5px 12px", textDecoration: "none", fontSize: 12 }}
          >
            Hardware hub
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
            style={{ padding: "5px 12px", textDecoration: "none", fontSize: 12 }}
          >
            GitHub ↗
          </a>
        </div>
      </nav>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main style={{ background: "var(--bg-base)", minHeight: "100vh", paddingTop: 52 }}>
        <div style={{ position: "relative" }}>
            {!wideLayout ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setHistoryDrawerOpen(true)}
                style={{
                  position: "fixed",
                  left: 12,
                  bottom: 56,
                  zIndex: 40,
                  padding: "10px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "rgba(13,13,18,0.92)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                }}
              >
                History
              </button>
            ) : null}

            {!wideLayout && historyDrawerOpen ? (
              <div
                role="presentation"
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 190,
                  background: "rgba(0,0,0,0.55)",
                  display: "flex",
                  justifyContent: "flex-start",
                  paddingTop: 52,
                }}
                onClick={() => setHistoryDrawerOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setHistoryDrawerOpen(false);
                }}
              >
                <div onClick={(e) => e.stopPropagation()}>
                  <CircuitHistorySidebar
                    variant="drawer"
                    entries={historyEntries}
                    onSelect={handleHistorySelect}
                    onPublishPrompt={handlePublishToHub}
                    canPublish={canPublishHub}
                    publishHint="Sign in to publish a project to the Hardware hub."
                    onCloseDrawer={() => setHistoryDrawerOpen(false)}
                  />
                </div>
              </div>
            ) : null}

            <div
              style={{
                marginLeft: wideLayout ? CIRCUIT_HISTORY_RAIL_WIDTH_PX : 0,
                minHeight: "calc(100vh - 52px)",
                boxSizing: "border-box",
              }}
            >
              <div style={{ maxWidth: 920, margin: "0 auto", padding: "64px 24px 80px" }}>

          {/* ── Hero ──────────────────────────────────────────────────── */}
          <header style={{ marginBottom: 52, textAlign: "center" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 99,
                background: "var(--accent-dim)",
                border: "1px solid rgba(110,231,247,0.2)",
                marginBottom: 20,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-space), system-ui, sans-serif",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--accent)",
                }}
              >
                AI-Powered PCB Design
              </span>
            </div>

            <h1
              style={{
                fontSize: "clamp(2.4rem, 5vw, 3.6rem)",
                fontFamily: "var(--font-space), system-ui, sans-serif",
                fontWeight: 700,
                letterSpacing: "-0.04em",
                lineHeight: 1.05,
                color: "var(--text-1)",
                marginBottom: 18,
              }}
            >
              From spec to schematic
              <br />
              <span
                style={{
                  background: "linear-gradient(90deg, #6ee7f7 0%, #a78bfa 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                in seconds.
              </span>
            </h1>

            <p
              style={{
                fontSize: 16,
                color: "var(--text-2)",
                lineHeight: 1.7,
                maxWidth: 520,
                margin: "0 auto",
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              }}
            >
              Describe any IC circuit or upload a datasheet. Get a live-sourced bill of materials and interactive wiring diagram.
            </p>
          </header>

          {/* ── Input form ────────────────────────────────────────────── */}
          <InputForm onRun={handleRun} loading={loading} />

          {/* ── Clarification card ────────────────────────────────────── */}
          {clarificationQuestions && !loading && (
            <ClarificationCard
              questions={clarificationQuestions}
              onSubmit={runWithAnswers}
              loading={loading}
            />
          )}

          {/* ── Progress ──────────────────────────────────────────────── */}
          {loading && (
            <div style={{ marginTop: 16 }}>
              <StatusBar status={status} loading={loading} step={step} inline />
            </div>
          )}

          {/* ── Results ───────────────────────────────────────────────── */}
          {hasResult && (
            <div style={{ marginTop: 56 }}>

              {/* Demo badge */}
              {isDemo && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.25)",
                    marginBottom: 20,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "#f59e0b",
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-space), system-ui, sans-serif",
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "#f59e0b",
                    }}
                  >
                    Demo circuit — TPS563201 12V→5V 2A buck converter
                  </span>
                </div>
              )}

              {/* Section header + tab bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 20,
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <p className="section-label" style={{ marginBottom: 4 }}>
                    {isDemo ? "Demo Results" : "Your Design"}
                  </p>
                  <h2 style={{ fontSize: 20, color: "var(--text-1)" }}>
                    {wiringGraph.nodes.length} components
                    {!isDemo && ` sourced`}
                  </h2>
                </div>

                {/* Right-side controls: save + export + tab switcher */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: "7px 12px", fontSize: 12 }}
                      onClick={() => setSaveOpen(true)}
                      title="Save the current wiring graph to your account (requires sign-in)"
                    >
                      Save design
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: "7px 12px", fontSize: 12 }}
                      onClick={() => setSavedOpen(true)}
                      title="Open a previously saved design (requires sign-in)"
                    >
                      My designs
                    </button>
                    {!isDemo ? (
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ padding: "7px 12px", fontSize: 12 }}
                        disabled={!canPublishHub}
                        title={
                          canPublishHub
                            ? "Publish this design to the Hardware hub (SKiDL .py + wiring graph)"
                            : "Sign in to publish to the Hardware hub"
                        }
                        onClick={() => void handlePublishToHub()}
                      >
                        Publish to hub…
                      </button>
                    ) : null}
                  </div>

                  {/* KiCad export button group */}
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      onClick={handleSkidlExport}
                      disabled={skidlState === "loading"}
                      title={
                        skidlState === "loading"
                          ? skidlMsg
                          : skidlState === "error"
                          ? skidlMsg
                          : "Generate SKiDL script with Gemini + ERC repair loop"
                      }
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 14px",
                        borderRadius: 9,
                        fontSize: 12,
                        fontFamily: "var(--font-space), system-ui, sans-serif",
                        fontWeight: 600,
                        letterSpacing: "0.01em",
                        border: skidlState === "error"
                          ? "1px solid rgba(239,68,68,0.4)"
                          : skidlState === "done"
                          ? "1px solid rgba(34,197,94,0.4)"
                          : "1px solid rgba(110,231,247,0.25)",
                        background: skidlState === "error"
                          ? "rgba(239,68,68,0.08)"
                          : skidlState === "done"
                          ? "rgba(34,197,94,0.08)"
                          : "rgba(110,231,247,0.06)",
                        color: skidlState === "error"
                          ? "#f87171"
                          : skidlState === "done"
                          ? "#4ade80"
                          : "var(--accent)",
                        cursor: skidlState === "loading" ? "not-allowed" : "pointer",
                        opacity: skidlState === "loading" ? 0.7 : 1,
                        transition: "all 150ms ease",
                      }}
                    >
                      {skidlState === "loading" ? (
                        <>
                          <span
                            className="pulse-dot"
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: "var(--accent)",
                              display: "inline-block",
                            }}
                          />
                          {skidlMsg || "Working…"}
                        </>
                      ) : skidlState === "done" ? (
                        <>
                          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          .py downloaded
                        </>
                      ) : skidlState === "error" ? (
                        <>
                          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                            <circle cx={12} cy={12} r={10} /><path d="M12 8v4M12 16h.01" />
                          </svg>
                          ERC issues — retry
                        </>
                      ) : (
                        <>
                          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="16 18 22 12 16 6" />
                            <polyline points="8 6 2 12 8 18" />
                          </svg>
                          Export to KiCad
                        </>
                      )}
                    </button>

                    {/* Download .net separately when ERC passed */}
                    {skidlNetlist && (
                      <button
                        onClick={handleSkidlNetlistDownload}
                        title="Download KiCad netlist (.net) — import into PCBnew"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "7px 12px",
                          borderRadius: 9,
                          fontSize: 12,
                          fontFamily: "var(--font-space), system-ui, sans-serif",
                          fontWeight: 600,
                          border: "1px solid rgba(34,197,94,0.4)",
                          background: "rgba(34,197,94,0.08)",
                          color: "#4ade80",
                          cursor: "pointer",
                          transition: "all 150ms ease",
                        }}
                      >
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1={12} y1={15} x2={12} y2={3} />
                        </svg>
                        .net
                      </button>
                    )}
                  </div>

                  {/* Tab switcher */}
                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      background: "var(--bg-input)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: 4,
                    }}
                  >
                    <button
                      className={`tab-btn${activeTab === "diagram" ? " active" : ""}`}
                      onClick={() => setActiveTab("diagram")}
                    >
                      Wiring Diagram
                    </button>
                    <button
                      className={`tab-btn${activeTab === "bom" ? " active" : ""}`}
                      onClick={() => setActiveTab("bom")}
                    >
                      Bill of Materials
                    </button>
                  </div>
                </div>
              </div>

              {/* Diagram tab */}
              {activeTab === "diagram" && (
                <div>
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--text-3)",
                      marginBottom: 14,
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                    }}
                  >
                    Hover a component to trace its connections · click to open sourcing details
                  </p>
                  <WiringDiagram
                    wiringGraph={wiringGraph}
                    hoveredNodeId={hoveredNodeId}
                    highlightedEdgeId={highlightedEdgeId}
                    onNodeHover={handleNodeHover}
                    onNodeClick={setSelectedNode}
                    onEdgeHighlight={setHighlightedEdgeId}
                  />
                </div>
              )}

              {/* BOM tab */}
              {activeTab === "bom" && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginBottom: 14,
                    }}
                  >
                    <button
                      onClick={handleBomDownload}
                      className="btn-ghost"
                      style={{ padding: "7px 14px" }}
                    >
                      Export CSV ↓
                    </button>
                  </div>
                  <BomTable nodes={wiringGraph.nodes} />
                </div>
              )}
            </div>
          )}
              </div>
            </div>
        </div>
      </main>

      {wideLayout ? (
        <CircuitHistorySidebar
          variant="rail"
          entries={historyEntries}
          onSelect={handleHistorySelect}
          onPublishPrompt={handlePublishToHub}
          canPublish={canPublishHub}
          publishHint="Sign in to publish a project to the Hardware hub."
        />
      ) : null}

      {/* ── Sourcing panel — fixed right overlay ──────────────────────── */}
              <SaveDesignDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        wiringGraph={wiringGraph}
        prompt={lastPrompt}
        skidlPy={skidlScript}
        getIdToken={getIdToken}
      />

      <SavedDesignsModal
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        getIdToken={getIdToken}
        onLoad={handleLoadSaved}
      />

      <SourcingPanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        circuitDescription={(() => {
          const ic = wiringGraph.nodes.find((n) => n.label.includes("\n"));
          const icLabel = ic ? ic.label.replace(/\n/g, " ") : "unknown IC";
          const nodeCount = wiringGraph.nodes.length;
          const edgeCount = wiringGraph.edges.length;
          const nodeEdges = selectedNode
            ? wiringGraph.edges.filter(
                (e) => e.from === selectedNode.id || e.to === selectedNode.id
              )
            : [];
          const nets = nodeEdges.map((e) => e.label).join(", ");
          return `${nodeCount}-component circuit built around ${icLabel} with ${edgeCount} connections. This component (${selectedNode?.id ?? ""}) is connected to nets: ${nets || "none"}.`;
        })()}
      />
    </>
  );
}
