"use client";

import { motion, AnimatePresence } from "framer-motion";

const STEP_LABELS: Record<number, string> = {
  1: "Step 1/4 — Parsing datasheet",
  2: "Step 2/4 — Calculating values",
  3: "Step 3/4 — Sourcing parts",
  4: "Step 4/4 — Building diagram",
};

interface StatusBarProps {
  status: string;
  loading: boolean;
  step?: 1 | 2 | 3 | 4 | null;
  /** When true, renders inline (not fixed/floating) */
  inline?: boolean;
}

export default function StatusBar({ status, loading, step, inline }: StatusBarProps) {
  const stepLabel = step != null ? STEP_LABELS[step] : null;
  const displayText = stepLabel ? `${stepLabel} — ${status}` : status;

  const inner = (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-mid)",
        borderRadius: 10,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {loading ? (
        <div
          className="pulse-dot"
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#6ee7f7",
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#34d399",
            flexShrink: 0,
          }}
        />
      )}

      {/* Step progress pills */}
      {loading && step != null && (
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: s <= step ? "#6ee7f7" : "rgba(255,255,255,0.12)",
                transition: "background 300ms ease",
              }}
            />
          ))}
        </div>
      )}

      <span
        style={{
          fontSize: 13,
          color: "var(--text-2)",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {displayText}
      </span>
    </div>
  );

  if (inline) {
    return (
      <AnimatePresence>
        {(loading || status) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {inner}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {(loading || status) && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 30, minWidth: 240, maxWidth: 480 }}
        >
          {inner}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
