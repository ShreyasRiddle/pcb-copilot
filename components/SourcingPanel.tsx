"use client";

import { useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ComponentNode } from "@/lib/types";
import { parseExplanation } from "@/lib/explainParse";

interface SourcingPanelProps {
  node: ComponentNode | null;
  onClose: () => void;
  circuitDescription?: string;
}

type Tab = "sourcing" | "explain";

function componentValue(node: ComponentNode): string {
  const parts = node.label.split(/\\n|\n/);
  return parts[parts.length - 1].trim() || node.id;
}

/** Hide delimiter markers while text is still streaming */
function stripExplainMarkers(s: string): string {
  return s
    .replace(/<<<ROLE>>>\s*/gi, "")
    .replace(/<<<MATH>>>\s*/gi, "\n\n")
    .replace(/<<<RISK>>>\s*/gi, "\n\n")
    .trim();
}

function CollapsibleExplainSection({
  sectionId,
  icon,
  title,
  subtitle,
  children,
  accent,
  expanded,
  onToggle,
}: {
  sectionId: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
  accent: "cyan" | "violet" | "amber";
  expanded: boolean;
  onToggle: () => void;
}) {
  const border =
    accent === "cyan"
      ? "rgba(110,231,247,0.22)"
      : accent === "violet"
        ? "rgba(167,139,250,0.22)"
        : "rgba(251,191,36,0.22)";
  const glow =
    accent === "cyan"
      ? "rgba(110,231,247,0.06)"
      : accent === "violet"
        ? "rgba(167,139,250,0.06)"
        : "rgba(251,191,36,0.06)";

  const headerId = `explain-section-${sectionId}-header`;

  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${border}`,
        background: `linear-gradient(145deg, ${glow}, rgba(255,255,255,0.02))`,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        id={headerId}
        aria-expanded={expanded}
        aria-controls={`explain-section-${sectionId}-panel`}
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "12px 14px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: accent === "cyan" ? "#67e8f9" : accent === "violet" ? "#c4b5fd" : "#fcd34d",
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              fontFamily: "var(--font-space), system-ui, sans-serif",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.35)",
              marginBottom: 2,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.45)",
              lineHeight: 1.35,
            }}
          >
            {subtitle}
          </div>
        </div>
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            marginTop: 4,
            color: "rgba(255,255,255,0.4)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={`explain-section-${sectionId}-panel`}
            role="region"
            aria-labelledby={headerId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                padding: "0 14px 14px 56px",
                fontSize: 13,
                color: "rgba(255,255,255,0.88)",
                lineHeight: 1.55,
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              }}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SourcingPanel({
  node,
  onClose,
  circuitDescription,
}: SourcingPanelProps) {
  const [tab, setTab] = useState<Tab>("sourcing");
  const [explanation, setExplanation] = useState<string>("");
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explainOpen, setExplainOpen] = useState({
    role: true,
    math: true,
    risk: true,
  });

  useEffect(() => {
    setTab("sourcing");
    setExplanation("");
    setExplainError(null);
    setExplaining(false);
    setExplainOpen({ role: true, math: true, risk: true });
  }, [node?.id]);

  const parsed = useMemo(
    () => (!explaining && explanation ? parseExplanation(explanation) : null),
    [explaining, explanation]
  );

  const fetchExplanation = useCallback(async () => {
    if (!node || explaining) return;
    setExplaining(true);
    setExplanation("");
    setExplainError(null);

    try {
      const res = await fetch("/api/explain-component", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: node.label.replace(/\n/g, " "),
          value: componentValue(node),
          reasoning: node.reasoning ?? "",
          circuitDescription: circuitDescription ?? "",
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

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
              text?: string;
              message?: string;
            };
            if (event.type === "chunk" && event.text) {
              setExplanation((prev) => prev + event.text);
            } else if (event.type === "error") {
              setExplainError(event.message ?? "Unknown error");
            }
          } catch {
            // non-JSON line
          }
        }
      }
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setExplaining(false);
    }
  }, [node, explaining, circuitDescription]);

  const handleTabChange = useCallback(
    (next: Tab) => {
      setTab(next);
      if (next === "explain" && !explanation && !explaining && !explainError) {
        fetchExplanation();
      }
    },
    [explanation, explaining, explainError, fetchExplanation]
  );

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key={node.id}
          initial={{ x: 340, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 340, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="glass fixed right-4 top-4 z-30 flex flex-col overflow-hidden h-fit"
          style={{
            width: "min(92vw, 22rem)",
            maxHeight: "calc(100vh - 2rem)",
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-white/10">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-[10px] uppercase tracking-widest text-cyan-400 mb-1">
                {node.id}
              </div>
              <div
                className="text-lg font-semibold text-white leading-snug"
                style={{ fontFamily: "var(--font-space), system-ui, sans-serif" }}
                title={node.label.replace(/\n/g, " ")}
              >
                {node.label.replace(/\n/g, " ")}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleTabChange("explain")}
              title="Explain this component"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: "50%",
                border:
                  tab === "explain"
                    ? "1px solid rgba(110,231,247,0.45)"
                    : "1px solid rgba(255,255,255,0.12)",
                background:
                  tab === "explain" ? "rgba(110,231,247,0.12)" : "transparent",
                color: tab === "explain" ? "#6ee7f7" : "rgba(255,255,255,0.35)",
                cursor: "pointer",
                transition: "all 150ms ease",
                marginLeft: 8,
                flexShrink: 0,
              }}
            >
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <circle cx={12} cy={12} r={10} />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-colors text-xl leading-none ml-2"
              style={{ flexShrink: 0 }}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div
            style={{
              display: "flex",
              padding: "0 12px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              gap: 4,
            }}
          >
            {(["sourcing", "explain"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTabChange(t)}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  fontSize: 11,
                  fontFamily: "var(--font-space), system-ui, sans-serif",
                  fontWeight: 600,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  border: "none",
                  background: "transparent",
                  color: tab === t ? "#6ee7f7" : "rgba(255,255,255,0.32)",
                  cursor: "pointer",
                  borderBottom: tab === t ? "2px solid #6ee7f7" : "2px solid transparent",
                  marginBottom: -1,
                  transition: "color 120ms ease",
                }}
              >
                {t === "sourcing" ? "Sourcing" : "Explain"}
              </button>
            ))}
          </div>

          {/* Sourcing — compact card, no flex-1 (avoids tall empty panel) */}
          {tab === "sourcing" && (
            <div className="px-4 pb-3 shrink-0">
              {node.bom ? (
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(0,0,0,0.25)",
                    overflow: "hidden",
                  }}
                >
                  {(
                    [
                      ["Part #", node.bom.partNumber, "mono"] as const,
                      ["Distributor", node.bom.distributor ?? "Digikey", "text"] as const,
                      ["Price", node.bom.price, "price"] as const,
                      [
                        "Stock",
                        node.bom.backordered ? "Backordered" : "In Stock",
                        node.bom.backordered ? "warn" : "ok",
                      ] as const,
                    ] as const
                  ).map(([label, val, kind], i, arr) => (
                    <div
                      key={label}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "92px 1fr",
                        gap: "8px 10px",
                        alignItems: "baseline",
                        padding: "10px 12px",
                        borderBottom:
                          i < arr.length - 1 ? "1px solid rgba(255,255,255,0.06)" : undefined,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: "var(--font-space), system-ui, sans-serif",
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "rgba(255,255,255,0.38)",
                        }}
                      >
                        {label}
                      </span>
                      <span
                        style={{
                          fontSize: kind === "mono" ? 11 : 12,
                          fontFamily:
                            kind === "mono"
                              ? "var(--font-geist-mono), ui-monospace, monospace"
                              : "var(--font-geist-sans), system-ui, sans-serif",
                          color:
                            kind === "price"
                              ? "#4ade80"
                              : kind === "ok"
                                ? "#4ade80"
                                : kind === "warn"
                                  ? "#fbbf24"
                                  : "rgba(255,255,255,0.92)",
                          fontWeight: kind === "price" || kind === "ok" || kind === "warn" ? 600 : 400,
                          lineHeight: 1.45,
                          wordBreak: "break-word",
                        }}
                      >
                        {kind === "warn" && (
                          <span
                            style={{
                              display: "inline-block",
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "#f59e0b",
                              marginRight: 6,
                              verticalAlign: "middle",
                            }}
                          />
                        )}
                        {val}
                      </span>
                    </div>
                  ))}

                  {node.reasoning && (
                    <div
                      style={{
                        padding: "10px 12px",
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        background: "rgba(255,255,255,0.03)",
                      }}
                    >
                      <p
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.35)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: 6,
                          fontFamily: "var(--font-space), system-ui, sans-serif",
                          fontWeight: 600,
                        }}
                      >
                        Why this part
                      </p>
                      <p
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.65)",
                          lineHeight: 1.5,
                        }}
                      >
                        {node.reasoning}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 italic leading-relaxed px-1">
                  No sourcing data — run the pipeline with a prompt or datasheet to populate.
                </p>
              )}
            </div>
          )}

          {/* Explain — scrollable body; panel grows up to max-h */}
          {tab === "explain" && (
            <div
              className="px-4 py-3 flex-1 overflow-y-auto min-h-0"
              style={{ maxHeight: "min(65vh, 520px)" }}
            >
              {explainError ? (
                <div style={{ fontSize: 13, color: "#f87171", lineHeight: 1.6 }}>
                  <p style={{ marginBottom: 8, fontWeight: 600 }}>Could not generate explanation</p>
                  <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{explainError}</p>
                  <button
                    type="button"
                    onClick={fetchExplanation}
                    style={{
                      marginTop: 14,
                      padding: "8px 14px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: "var(--font-space), system-ui, sans-serif",
                      fontWeight: 600,
                      border: "1px solid rgba(239,68,68,0.35)",
                      background: "rgba(239,68,68,0.08)",
                      color: "#f87171",
                      cursor: "pointer",
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : explaining && !explanation ? (
                <div style={{ paddingTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                    <span
                      className="pulse-dot"
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#6ee7f7",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        color: "rgba(255,255,255,0.5)",
                        fontFamily: "var(--font-space), system-ui, sans-serif",
                      }}
                    >
                      Composing explanation…
                    </span>
                  </div>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="skeleton-bar"
                      style={{
                        height: 72,
                        borderRadius: 12,
                        marginBottom: 10,
                        opacity: 0.45,
                      }}
                    />
                  ))}
                  </div>
              ) : explaining && explanation ? (
                <div>
                  <p
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.5)",
                      lineHeight: 1.65,
                      whiteSpace: "pre-wrap",
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                    }}
                  >
                    {stripExplainMarkers(explanation)}
                  <span
                      style={{
                        display: "inline-block",
                        width: 5,
                        height: 14,
                        background: "#6ee7f7",
                        marginLeft: 3,
                        verticalAlign: "middle",
                        borderRadius: 1,
                        animation: "pulse-dot 1s infinite",
                      }}
                    />
                  </p>
                </div>
              ) : parsed ? (
                <div>
                  <CollapsibleExplainSection
                    sectionId="role"
                    accent="cyan"
                    title="Role"
                    subtitle="What this part does in the circuit"
                    expanded={explainOpen.role}
                    onToggle={() =>
                      setExplainOpen((o) => ({ ...o, role: !o.role }))
                    }
                    icon={
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                    }
                  >
                    {parsed.role}
                  </CollapsibleExplainSection>
                  <CollapsibleExplainSection
                    sectionId="math"
                    accent="violet"
                    title="Math & sizing"
                    subtitle="Equations and rules used to pick this value"
                    expanded={explainOpen.math}
                    onToggle={() =>
                      setExplainOpen((o) => ({ ...o, math: !o.math }))
                    }
                    icon={
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        <path d="M8 7h6M8 11h4" />
                      </svg>
                    }
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                        fontSize: 12.5,
                        letterSpacing: "-0.01em",
                        display: "block",
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "rgba(0,0,0,0.35)",
                        border: "1px solid rgba(167,139,250,0.2)",
                        color: "rgba(237,233,254,0.95)",
                        lineHeight: 1.6,
                      }}
                    >
                      {parsed.math}
                  </span>
                  </CollapsibleExplainSection>
                  <CollapsibleExplainSection
                    sectionId="risk"
                    accent="amber"
                    title="If it goes wrong"
                    subtitle="Typical failure mode"
                    expanded={explainOpen.risk}
                    onToggle={() =>
                      setExplainOpen((o) => ({ ...o, risk: !o.risk }))
                    }
                    icon={
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1={12} y1={9} x2={12} y2={13} />
                        <line x1={12} y1={17} x2={12.01} y2={17} />
                      </svg>
                    }
                  >
                    {parsed.risk}
                  </CollapsibleExplainSection>
                  <button
                    type="button"
                    onClick={fetchExplanation}
                    style={{
                      width: "100%",
                      marginTop: 4,
                      padding: "8px",
                      fontSize: 11,
                      fontFamily: "var(--font-space), system-ui, sans-serif",
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      color: "rgba(255,255,255,0.35)",
                      background: "transparent",
                      border: "1px dashed rgba(255,255,255,0.12)",
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                  >
                    Regenerate
                  </button>
                </div>
              ) : explanation ? (
                <div
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.78)",
                    lineHeight: 1.65,
                    whiteSpace: "pre-wrap",
                    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                  }}
                >
                  {stripExplainMarkers(explanation)}
              </div>
            ) : (
                <button
                  type="button"
                  onClick={fetchExplanation}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 16px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontFamily: "var(--font-space), system-ui, sans-serif",
                    fontWeight: 600,
                    border: "1px solid rgba(110,231,247,0.28)",
                    background: "rgba(110,231,247,0.08)",
                    color: "#6ee7f7",
                    cursor: "pointer",
                  }}
                >
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <circle cx={12} cy={12} r={10} />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  Explain this component
                </button>
            )}
          </div>
          )}

          {tab === "sourcing" && node.bom?.url && (
            <div className="px-4 pb-4 pt-1 shrink-0">
              <a
                href={node.bom.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-500/40 text-cyan-300 text-sm font-medium transition-colors"
              >
                Buy on {node.bom.distributor ?? "Digikey"} →
              </a>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
