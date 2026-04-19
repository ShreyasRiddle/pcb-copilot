/** Shared types for Hardware Hub (KiCad projects). */

import type { WiringGraph } from "./types";

export type HardwareVisibility = "public" | "unlisted" | "private";

export interface PcbStats {
  /** e.g. 2 for 2-layer */
  copperLayers?: number;
  /** Approximate board width × height in mm (from bounding box if parsed) */
  widthMm?: number;
  heightMm?: number;
}

export interface RawBomLine {
  reference: string;
  value: string;
  footprint: string;
  libSymbol?: string;
  /** Quantity when grouped */
  quantity?: number;
}

export interface EnrichedBomLine extends RawBomLine {
  partNumber?: string;
  price?: string;
  url?: string;
  distributor?: string;
  inStock?: boolean;
  notes?: string;
}

export interface HardwareProjectMeta {
  projectId: string;
  ownerSub: string;
  title: string;
  description: string;
  licenseSpdx: string;
  visibility: HardwareVisibility;
  readmeMarkdown?: string;
  starCount: number;
  forkCount: number;
  forkedFromProjectId?: string;
  forkedFromRevisionId?: string;
  createdAt: string;
  updatedAt: string;
  latestRevisionId: string | null;
}

/** Discussion thread item under a hardware project (Dynamo sk COMMENT#…). */
export interface HardwareComment {
  commentId: string;
  projectId: string;
  authorSub: string;
  body: string;
  createdAt: string;
}

export interface HardwareRevision {
  revisionId: string;
  projectId: string;
  /** Present on stored Dynamo items for auth checks */
  ownerSub?: string;
  s3Key: string;
  sizeBytes: number;
  sha256: string;
  fileManifest: string[];
  bomRaw: RawBomLine[];
  bomEnriched: EnrichedBomLine[] | null;
  pcbStats: PcbStats | null;
  /** Built at finalize from BOM + optional Gemini net inference; same shape as PCB Copilot home. */
  wiringGraph?: WiringGraph | null;
  analysisStatus: "pending" | "complete" | "failed";
  analysisError?: string;
  createdAt: string;
}

export const COMMON_LICENSES: { id: string; label: string }[] = [
  { id: "MIT", label: "MIT" },
  { id: "Apache-2.0", label: "Apache 2.0" },
  { id: "BSD-3-Clause", label: "BSD 3-Clause" },
  { id: "GPL-3.0-only", label: "GPL 3.0" },
  { id: "CERN-OHL-S-2.0", label: "CERN-OHL-S-2.0" },
  { id: "CC-BY-4.0", label: "CC BY 4.0" },
  { id: "CC0-1.0", label: "CC0 1.0" },
];
