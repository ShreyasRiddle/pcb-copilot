/**
 * Browser-only history of successful Copilot pipeline runs (localStorage).
 */

import type { WiringGraph } from "./types";

const STORAGE_KEY = "pcb_copilot_run_history_v1";
const MAX_ENTRIES = 30;
const HISTORY_EVENT = "pcb-copilot-circuit-history";

export interface CircuitRunHistoryEntry {
  id: string;
  prompt: string;
  createdAt: string;
  wiringGraph: WiringGraph;
}

function notifyHistoryChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(HISTORY_EVENT));
  }
}

function loadEntries(): CircuitRunHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as { entries?: CircuitRunHistoryEntry[] };
    if (!Array.isArray(data.entries)) return [];
    return data.entries.filter(
      (e) =>
        e &&
        typeof e.id === "string" &&
        typeof e.prompt === "string" &&
        typeof e.createdAt === "string" &&
        e.wiringGraph &&
        Array.isArray(e.wiringGraph.nodes)
    );
  } catch {
    return [];
  }
}

function saveEntries(entries: CircuitRunHistoryEntry[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ entries }));
    return true;
  } catch {
    return false;
  }
}

export function listCircuitRunHistory(): CircuitRunHistoryEntry[] {
  return loadEntries();
}

/** Subscribe to history updates (same tab). Returns unsubscribe. */
export function subscribeCircuitRunHistory(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(HISTORY_EVENT, cb);
  return () => window.removeEventListener(HISTORY_EVENT, cb);
}

export function appendCircuitRunHistory(input: {
  prompt: string;
  wiringGraph: WiringGraph;
}): void {
  if (typeof window === "undefined") return;
  const prompt = input.prompt.trim();
  if (!prompt || !input.wiringGraph?.nodes?.length) return;

  let entries = loadEntries();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  entries = entries.filter((e) => {
    if (e.prompt !== prompt) return true;
    const t = Date.parse(e.createdAt);
    if (Number.isNaN(t)) return true;
    return now - t > 60_000;
  });

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `run-${now}`;
  entries.unshift({
    id,
    prompt,
    createdAt: nowIso,
    wiringGraph: input.wiringGraph,
  });
  entries = entries.slice(0, MAX_ENTRIES);

  if (saveEntries(entries)) {
    notifyHistoryChanged();
  }
}

export function formatHistoryTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return new Date(t).toLocaleDateString();
}
