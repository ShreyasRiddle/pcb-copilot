"use client";

import { useState, useCallback } from "react";
import { ComponentNode } from "@/lib/types";
import { useCircuitPipeline } from "@/hooks/useCircuitPipeline";
import InputForm from "@/components/InputForm";
import WiringDiagram from "@/components/WiringDiagram";
import BomTable from "@/components/BomTable";
import SourcingPanel from "@/components/SourcingPanel";
import StatusBar from "@/components/StatusBar";
import ClarificationCard from "@/components/ClarificationCard";

export default function Home() {
  const [selectedNode, setSelectedNode] = useState<ComponentNode | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [highlightedEdgeId, setHighlightedEdgeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"bom" | "diagram">("diagram");

  const { loading, status, step, wiringGraph, hasResult, isDemo, clarificationQuestions, run, runWithAnswers } =
    useCircuitPipeline();

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

        {/* Nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
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
      </main>

      {/* ── Sourcing panel — fixed right overlay ──────────────────────── */}
      <SourcingPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
    </>
  );
}
