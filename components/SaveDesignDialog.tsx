"use client";

import { useId, useState } from "react";
import { SAVED_DESIGNS_503_MESSAGE } from "@/lib/savedDesignsConstants";
import { saveLocalDesign } from "@/lib/savedDesignsLocal";
import type { WiringGraph } from "@/lib/types";

interface SaveDesignDialogProps {
  open: boolean;
  onClose: () => void;
  wiringGraph: WiringGraph;
  prompt: string;
  getIdToken: () => Promise<string | null>;
  onSaved?: () => void;
}

export default function SaveDesignDialog({
  open,
  onClose,
  wiringGraph,
  prompt,
  getIdToken,
  onSaved,
}: SaveDesignDialogProps) {
  const titleId = useId();
  const [title, setTitle] = useState("My design");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSave = async () => {
    const token = await getIdToken();
    if (!token) {
      setError("Sign in to save.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim() || "Untitled",
          prompt,
          wiringGraph,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (res.ok) {
        onSaved?.();
        onClose();
        return;
      }
      if (res.status === 503 && data.error === SAVED_DESIGNS_503_MESSAGE) {
        const saved = saveLocalDesign({
          title: title.trim() || "Untitled",
          prompt,
          wiringGraph,
        });
        if (saved) {
          onSaved?.();
          onClose();
          return;
        }
        setError(
          "Cloud save is not configured and browser storage could not save (quota or private mode)."
        );
        return;
      }
      setError(data.error ?? `Save failed (${res.status})`);
    } catch {
      setError("Save failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.55)",
      }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          width: "min(380px, 100%)",
          borderRadius: 14,
          background: "var(--bg-card)",
          border: "1px solid var(--border-mid)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          padding: "16px 18px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id={titleId}
          style={{
            margin: "0 0 12px",
            fontSize: 15,
            fontFamily: "var(--font-space), system-ui, sans-serif",
            fontWeight: 600,
            color: "var(--text-1)",
          }}
        >
          Save design
        </h2>
        <label
          htmlFor="save-design-title"
          style={{ fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 6 }}
        >
          Title
        </label>
        <input
          id="save-design-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            width: "100%",
            marginBottom: 12,
            padding: "9px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg-input)",
            color: "var(--text-1)",
            fontSize: 13,
          }}
        />
        {error && (
          <p style={{ fontSize: 12, color: "#f87171", marginBottom: 10 }}>{error}</p>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn-ghost" style={{ padding: "8px 14px" }} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              border: "1px solid rgba(110,231,247,0.35)",
              background: "rgba(110,231,247,0.12)",
              color: "var(--accent)",
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.75 : 1,
            }}
            onClick={() => void handleSave()}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
