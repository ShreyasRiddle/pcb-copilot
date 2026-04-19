"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { SAVED_DESIGNS_503_MESSAGE } from "@/lib/savedDesignsConstants";
import {
  deleteLocalDesign,
  getLocalDesignFull,
  listLocalDesignSummaries,
} from "@/lib/savedDesignsLocal";
import type { WiringGraph } from "@/lib/types";

export interface DesignSummary {
  designId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface SavedDesignsModalProps {
  open: boolean;
  onClose: () => void;
  getIdToken: () => Promise<string | null>;
  onLoad: (graph: WiringGraph, prompt: string) => void;
}

export default function SavedDesignsModal({
  open,
  onClose,
  getIdToken,
  onLoad,
}: SavedDesignsModalProps) {
  const titleId = useId();
  const [list, setList] = useState<DesignSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [useLocalStorage, setUseLocalStorage] = useState(false);

  const fetchList = useCallback(async () => {
    const token = await getIdToken();
    if (!token) {
      setError("Sign in to see saved designs.");
      setList([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/designs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { designs?: DesignSummary[]; error?: string };
      if (res.ok) {
        setUseLocalStorage(false);
        setList(data.designs ?? []);
        return;
      }
      if (res.status === 503 && data.error === SAVED_DESIGNS_503_MESSAGE) {
        setUseLocalStorage(true);
        setList(listLocalDesignSummaries());
        setError(null);
        return;
      }
      setError(data.error ?? `Request failed (${res.status})`);
      setList([]);
    } catch {
      setError("Could not load designs.");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    if (open) void fetchList();
  }, [open, fetchList]);

  const handleLoad = async (id: string) => {
    const token = await getIdToken();
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      if (useLocalStorage) {
        const local = getLocalDesignFull(id);
        if (local) {
          onLoad(local.wiringGraph, local.prompt ?? "");
          onClose();
        } else {
          setError("Design not found.");
        }
        return;
      }
      const res = await fetch(`/api/designs/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as {
        wiringGraph?: WiringGraph;
        prompt?: string;
        error?: string;
      };
      if (!res.ok || !data.wiringGraph) {
        setError(data.error ?? "Could not load design.");
        return;
      }
      onLoad(data.wiringGraph, data.prompt ?? "");
      onClose();
    } catch {
      setError("Could not load design.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = await getIdToken();
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      if (useLocalStorage) {
        if (deleteLocalDesign(id)) {
          setList((prev) => prev.filter((d) => d.designId !== id));
        } else {
          setError("Delete failed.");
        }
        return;
      }
      const res = await fetch(`/api/designs/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Delete failed.");
        return;
      }
      setList((prev) => prev.filter((d) => d.designId !== id));
    } catch {
      setError("Delete failed.");
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;

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
          width: "min(420px, 100%)",
          maxHeight: "min(70vh, 520px)",
          display: "flex",
          flexDirection: "column",
          borderRadius: 14,
          background: "var(--bg-card)",
          border: "1px solid var(--border-mid)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <h2
              id={titleId}
              style={{
                margin: 0,
                fontSize: 15,
                fontFamily: "var(--font-space), system-ui, sans-serif",
                fontWeight: 600,
                color: "var(--text-1)",
              }}
            >
              My designs
            </h2>
            {useLocalStorage && (
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-3)", maxWidth: 280 }}>
                Stored in this browser. Set DESIGNS_TABLE_NAME (and AWS credentials) for cloud save.
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: "4px 10px", fontSize: 12 }}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div style={{ padding: 12, overflow: "auto", flex: 1 }}>
          {loading && (
            <p style={{ fontSize: 13, color: "var(--text-3)", margin: 8 }}>Loading…</p>
          )}
          {error && (
            <p style={{ fontSize: 12, color: "#f87171", margin: "0 8px 10px" }}>{error}</p>
          )}
          {!loading && list.length === 0 && !error && (
            <p style={{ fontSize: 13, color: "var(--text-3)", margin: 8 }}>
              No saved designs yet.
            </p>
          )}
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {list.map((d) => (
              <li
                key={d.designId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 8px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  marginBottom: 8,
                  background: "var(--bg-input)",
                }}
              >
                <button
                  type="button"
                  onClick={() => void handleLoad(d.designId)}
                  disabled={busyId !== null}
                  style={{
                    flex: 1,
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    color: "var(--text-1)",
                    cursor: busyId ? "wait" : "pointer",
                    fontSize: 13,
                    padding: 0,
                  }}
                >
                  <span style={{ fontWeight: 600, display: "block" }}>{d.title}</span>
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {d.createdAt ? new Date(d.createdAt).toLocaleString() : ""}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  aria-label={`Delete ${d.title}`}
                  onClick={(e) => void handleDelete(d.designId, e)}
                  disabled={busyId !== null}
                  style={{ padding: "6px 10px", fontSize: 11, flexShrink: 0 }}
                >
                  {busyId === d.designId ? "…" : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
