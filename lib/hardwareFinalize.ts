import { createHash } from "crypto";
import { buildWiringGraph } from "./buildWiringGraph";
import { putRevision } from "./dynamoHardware";
import { hardwareBomLinesToWiringBomItems } from "./hardwareBomToWiringItems";
import type { EnrichedBomLine, HardwareRevision, RawBomLine } from "./hardwareTypes";
import { inferKicadConnections } from "./kicadWiringInfer";
import type { KicadParseResult } from "./kicadParse";
import { parseKicadZip } from "./kicadParse";
import type { AIConnection } from "./pipeline";
import { enrichHardwareBomLines } from "./sourceParts";
import { getObjectBuffer } from "./s3Hardware";
import type { WiringGraph } from "./types";

/** In-memory validation before S3 upload (no persistence). */
export interface HardwareZipPreviewResult {
  ok: boolean;
  schematicFileCount: number;
  bomLineCount: number;
  message?: string;
}

async function buildHardwareWiringGraph(
  parsed: KicadParseResult,
  bomLines: (RawBomLine & Partial<EnrichedBomLine>)[],
  inferConnections: boolean,
  geminiKey: string | undefined
): Promise<WiringGraph | null> {
  if (bomLines.length === 0) return null;
  const items = hardwareBomLinesToWiringBomItems(bomLines);
  const refs = items.map((i) => i.id);
  let connections: AIConnection[] = [];
  if (inferConnections && geminiKey && parsed.schTextExcerpt.trim()) {
    try {
      connections = await inferKicadConnections(refs, parsed.schTextExcerpt, geminiKey);
    } catch {
      connections = [];
    }
  }
  return buildWiringGraph(items, connections);
}

function assertWiringGraphFromBom(
  wiringGraph: WiringGraph | null,
  context: string
): asserts wiringGraph is WiringGraph {
  if (!wiringGraph?.nodes?.length) {
    throw new Error(
      `${context}: could not build a wiring diagram from schematic symbols. Check .kicad_sch content.`
    );
  }
}

/**
 * Parse a zip in memory and ensure a BOM + node wiring graph can be built (no S3/Dynamo).
 * Net inference is skipped by default for speed; set HARDWARE_PREVIEW_INFER_NETS=1 to mirror finalize Gemini wiring.
 */
export async function previewHardwareZipBuffer(buf: Buffer): Promise<HardwareZipPreviewResult> {
  const parsed = await parseKicadZip(buf);
  const schematicFileCount = parsed.fileManifest.filter((p) =>
    p.toLowerCase().endsWith(".kicad_sch")
  ).length;

  if (parsed.bomLines.length === 0) {
    return {
      ok: false,
      schematicFileCount,
      bomLineCount: 0,
      message:
        schematicFileCount === 0
          ? "No .kicad_sch files found in the zip. Include KiCad 6+ schematic files."
          : "No schematic symbols found in the .kicad_sch files.",
    };
  }

  const previewInferNets = process.env.HARDWARE_PREVIEW_INFER_NETS === "1";
  const apiKey = process.env.GEMINI_API_KEY;
  const wiringGraph = await buildHardwareWiringGraph(
    parsed,
    parsed.bomLines,
    previewInferNets,
    previewInferNets ? apiKey : undefined
  );
  if (!wiringGraph?.nodes?.length) {
    return {
      ok: false,
      schematicFileCount,
      bomLineCount: parsed.bomLines.length,
      message: "Could not build a wiring diagram from the parsed BOM.",
    };
  }

  return {
    ok: true,
    schematicFileCount,
    bomLineCount: parsed.bomLines.length,
  };
}

export async function finalizeHardwareRevision(input: {
  projectId: string;
  ownerSub: string;
  revisionId: string;
  s3Key: string;
  declaredSize: number;
  declaredSha256: string;
}): Promise<HardwareRevision> {
  const buf = await getObjectBuffer(input.s3Key);
  if (buf.length !== input.declaredSize) {
    throw new Error(`Size mismatch: expected ${input.declaredSize}, got ${buf.length}`);
  }
  const sha = createHash("sha256").update(buf).digest("hex");
  if (sha !== input.declaredSha256.toLowerCase()) {
    throw new Error("SHA-256 checksum mismatch");
  }

  const parsed = await parseKicadZip(buf);
  const apiKey = process.env.GEMINI_API_KEY;

  if (parsed.bomLines.length === 0) {
    const schCount = parsed.fileManifest.filter((p) => p.toLowerCase().endsWith(".kicad_sch")).length;
    throw new Error(
      schCount === 0
        ? "No .kicad_sch files in the zip. Include at least one KiCad 6+ schematic."
        : "No schematic symbols found in .kicad_sch files."
    );
  }

  if (!apiKey) {
    const wiringGraph = await buildHardwareWiringGraph(
      parsed,
      parsed.bomLines,
      false,
      undefined
    );
    assertWiringGraphFromBom(wiringGraph, "Finalize");
    return putRevision({
      projectId: input.projectId,
      ownerSub: input.ownerSub,
      revisionId: input.revisionId,
      s3Key: input.s3Key,
      sizeBytes: buf.length,
      sha256: sha,
      fileManifest: parsed.fileManifest,
      bomRaw: parsed.bomLines,
      pcbStats: parsed.pcbStats,
      bomEnriched: null,
      wiringGraph,
      analysisStatus: "complete",
      analysisError:
        "GEMINI_API_KEY not set — raw BOM from schematic only (no distributor sourcing or inferred nets).",
    });
  }

  try {
    const bomEnriched = await enrichHardwareBomLines(parsed.bomLines, apiKey);
    const wiringGraph = await buildHardwareWiringGraph(parsed, bomEnriched, true, apiKey);
    assertWiringGraphFromBom(wiringGraph, "Finalize");
    return putRevision({
      projectId: input.projectId,
      ownerSub: input.ownerSub,
      revisionId: input.revisionId,
      s3Key: input.s3Key,
      sizeBytes: buf.length,
      sha256: sha,
      fileManifest: parsed.fileManifest,
      bomRaw: parsed.bomLines,
      pcbStats: parsed.pcbStats,
      bomEnriched,
      wiringGraph,
      analysisStatus: "complete",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Enrichment failed";
    const wiringGraph = await buildHardwareWiringGraph(parsed, parsed.bomLines, true, apiKey);
    assertWiringGraphFromBom(wiringGraph, "Finalize");
    return putRevision({
      projectId: input.projectId,
      ownerSub: input.ownerSub,
      revisionId: input.revisionId,
      s3Key: input.s3Key,
      sizeBytes: buf.length,
      sha256: sha,
      fileManifest: parsed.fileManifest,
      bomRaw: parsed.bomLines,
      pcbStats: parsed.pcbStats,
      bomEnriched: null,
      wiringGraph,
      analysisStatus: "failed",
      analysisError: msg,
    });
  }
}
