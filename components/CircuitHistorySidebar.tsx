"use client";

import type { CircuitRunHistoryEntry } from "@/lib/circuitRunHistory";

/** Fixed rail width — keep in sync with main column offset on the home page. */
export const CIRCUIT_HISTORY_RAIL_WIDTH_PX = 260;
import { formatHistoryTime } from "@/lib/circuitRunHistory";

interface CircuitHistorySidebarProps {
  entries: CircuitRunHistoryEntry[];
  onSelect: (entry: CircuitRunHistoryEntry) => void;
  onPublishPrompt: (prompt: string) => void;
  canPublish: boolean;
  /** Shown when canPublish is false (e.g. sign in first). */
  publishHint?: string;
  /** Narrow layout: drawer overlay */
  variant: "drawer" | "rail";
  onCloseDrawer?: () => void;
}

function truncate(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default function CircuitHistorySidebar({
  entries,
  onSelect,
  onPublishPrompt,
  canPublish,
  publishHint,
  variant,
  onCloseDrawer,
}: CircuitHistorySidebarProps) {
  const rail = variant === "rail";

  return (
    <aside
      style={{
        width: rail ? CIRCUIT_HISTORY_RAIL_WIDTH_PX : "min(300px, 92vw)",
        flexShrink: 0,
        borderRight: rail ? "1px solid var(--border)" : undefined,
        background: rail ? "rgba(13,13,18,0.92)" : "var(--bg-card)",
        display: "flex",
        flexDirection: "column",
        maxHeight: rail ? "calc(100vh - 52px)" : "85vh",
        height: rail ? "calc(100vh - 52px)" : undefined,
        position: rail ? "fixed" : "relative",
        left: rail ? 0 : undefined,
        top: rail ? 52 : undefined,
        zIndex: rail ? 50 : undefined,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          padding: "14px 14px 10px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <p
          className="section-label"
          style={{ margin: 0, fontSize: 10, letterSpacing: "0.06em" }}
        >
          History
        </p>
        {!rail && onCloseDrawer ? (
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: "4px 10px", fontSize: 11 }}
            onClick={onCloseDrawer}
          >
            Close
          </button>
        ) : null}
      </div>
      <div style={{ overflowY: "auto", flex: 1, padding: "8px 10px 16px" }}>
        {entries.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5, margin: "8px 4px" }}>
            Generated circuits appear here. Run the pipeline to build your history.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {entries.map((e) => (
              <li
                key={e.id}
                style={{
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  padding: "10px 10px 8px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelect(e);
                    if (!rail) onCloseDrawer?.();
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    color: "var(--text-1)",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, display: "block", lineHeight: 1.35 }}>
                    {truncate(e.prompt, 72)}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-3)", marginTop: 4, display: "block" }}>
                    {formatHistoryTime(e.createdAt)}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={!canPublish}
                  title={canPublish ? "Prefill new Hardware hub project (you still upload KiCad zip)" : publishHint}
                  style={{
                    marginTop: 8,
                    width: "100%",
                    fontSize: 11,
                    padding: "6px 8px",
                    opacity: canPublish ? 1 : 0.5,
                  }}
                  onClick={() => {
                    if (!canPublish) return;
                    onPublishPrompt(e.prompt);
                    if (!rail) onCloseDrawer?.();
                  }}
                >
                  Publish to Hardware hub…
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
