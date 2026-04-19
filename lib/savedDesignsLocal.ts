/**
 * Browser-only fallback when DESIGNS_TABLE_NAME is not set (or Cognito missing on server).
 * Imported only from client components.
 */

import type { WiringGraph } from "./types";

const STORAGE_KEY = "pcb_copilot_saved_designs_v1";

export interface LocalDesignRecord {
  designId: string;
  title: string;
  prompt: string;
  wiringGraph: WiringGraph;
  createdAt: string;
  updatedAt: string;
}

function loadRecords(): LocalDesignRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as { designs?: LocalDesignRecord[] };
    if (!Array.isArray(data.designs)) return [];
    return data.designs.filter(
      (d) =>
        d &&
        typeof d.designId === "string" &&
        d.wiringGraph &&
        Array.isArray(d.wiringGraph.nodes)
    );
  } catch {
    return [];
  }
}

function saveRecords(records: LocalDesignRecord[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ designs: records }));
    return true;
  } catch {
    return false;
  }
}

export function listLocalDesignSummaries(): Pick<
  LocalDesignRecord,
  "designId" | "title" | "createdAt" | "updatedAt"
>[] {
  return loadRecords()
    .map((d) => ({
      designId: d.designId,
      title: d.title,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getLocalDesignFull(id: string): LocalDesignRecord | null {
  return loadRecords().find((d) => d.designId === id) ?? null;
}

export function saveLocalDesign(input: {
  title: string;
  prompt: string;
  wiringGraph: WiringGraph;
}): LocalDesignRecord | null {
  if (typeof window === "undefined") return null;
  const records = loadRecords();
  const now = new Date().toISOString();
  const designId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `local-${Date.now()}`;
  const rec: LocalDesignRecord = {
    designId,
    title: input.title,
    prompt: input.prompt,
    wiringGraph: input.wiringGraph,
    createdAt: now,
    updatedAt: now,
  };
  records.push(rec);
  if (!saveRecords(records)) return null;
  return rec;
}

export function deleteLocalDesign(id: string): boolean {
  if (typeof window === "undefined") return false;
  const before = loadRecords();
  const records = before.filter((d) => d.designId !== id);
  if (records.length === before.length) return false;
  return saveRecords(records);
}
