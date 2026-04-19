/**
 * Parse KiCad 6+ `.kicad_sch` and `.kicad_pcb` from project zips.
 */

import JSZip from "jszip";
import type { PcbStats, RawBomLine } from "./hardwareTypes";

const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;

const MAX_SCH_EXCERPT_CHARS = 120_000;
const MAX_SCH_FILE_EXCERPT_CHARS = 40_000;

export interface KicadParseResult {
  fileManifest: string[];
  readmeText: string | null;
  bomLines: RawBomLine[];
  pcbStats: PcbStats | null;
  projectFiles: string[];
  /** Concatenated `.kicad_sch` text (capped) for model-assisted net inference. */
  schTextExcerpt: string;
  /** Individual schematic excerpts (per file) for file-by-file model inference. */
  schFileExcerpts: { path: string; text: string }[];
}


function buildSchFileExcerpts(parts: { path: string; text: string }[]): { path: string; text: string }[] {
  return parts.map(({ path, text }) => ({
    path,
    text:
      text.length > MAX_SCH_FILE_EXCERPT_CHARS
        ? text.slice(0, MAX_SCH_FILE_EXCERPT_CHARS)
        : text,
  }));
}

function buildSchTextExcerpt(parts: { path: string; text: string }[]): string {
  let out = "";
  for (const { path, text } of parts) {
    const header = `\n\n;;; ${path}\n`;
    if (out.length + header.length + text.length <= MAX_SCH_EXCERPT_CHARS) {
      out += header + text;
      continue;
    }
    const remain = MAX_SCH_EXCERPT_CHARS - out.length - header.length;
    if (remain > 800) {
      out += header + text.slice(0, remain);
    }
    break;
  }
  return out;
}

/** Tokenize S-expression into nested arrays */
function tokenize(input: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "(" || c === ")") {
      out.push(c);
      i++;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let s = "";
      while (j < input.length) {
        if (input[j] === "\\" && j + 1 < input.length) {
          s += input[j + 1];
          j += 2;
          continue;
        }
        if (input[j] === '"') break;
        s += input[j];
        j++;
      }
      out.push(JSON.stringify(s));
      i = j + 1;
      continue;
    }
    let j = i;
    while (j < input.length && !/[\s()]/.test(input[j])) j++;
    out.push(input.slice(i, j));
    i = j;
  }
  return out;
}

function parseTokens(tokens: string[], i: { v: number }): unknown {
  if (tokens[i.v] !== "(") return null;
  i.v++;
  const list: unknown[] = [];
  while (i.v < tokens.length && tokens[i.v] !== ")") {
    if (tokens[i.v] === "(") {
      list.push(parseTokens(tokens, i));
    } else {
      const t = tokens[i.v];
      if (t.startsWith('"')) {
        try {
          list.push(JSON.parse(t));
        } catch {
          list.push(t);
        }
      } else {
        list.push(t);
      }
      i.v++;
    }
  }
  if (tokens[i.v] === ")") i.v++;
  return list;
}

function parseSexpr(text: string): unknown | null {
  const tokens = tokenize(text);
  const i = { v: 0 };
  if (!tokens.length) return null;
  return parseTokens(tokens, i);
}

function findSymbols(node: unknown, out: unknown[][]): void {
  if (!Array.isArray(node)) return;
  if (node[0] === "symbol" && Array.isArray(node)) {
    out.push(node as unknown[]);
  }
  for (const child of node) {
    if (Array.isArray(child)) findSymbols(child, out);
  }
}

function getProperty(sym: unknown[], name: string): string {
  if (!Array.isArray(sym)) return "";
  for (const el of sym) {
    if (
      Array.isArray(el) &&
      el[0] === "property" &&
      typeof el[1] === "string" &&
      el[1] === name &&
      typeof el[2] === "string"
    ) {
      return el[2];
    }
  }
  return "";
}

export function extractBomFromSchContent(schText: string): RawBomLine[] {
  const tree = parseSexpr(schText);
  if (!tree) return [];
  const symbols: unknown[][] = [];
  findSymbols(tree, symbols);

  const lines: RawBomLine[] = [];
  for (const sym of symbols) {
    const ref = getProperty(sym, "Reference");
    const value = getProperty(sym, "Value");
    const fp = getProperty(sym, "Footprint");
    const libEl = sym.find(
      (x): x is [string, string, ...unknown[]] =>
        Array.isArray(x) && x[0] === "lib_id" && typeof x[1] === "string"
    );
    const libId = libEl?.[1] ?? "";
    if (!ref && !value) continue;
    lines.push({
      reference: ref || "?",
      value: value || "",
      footprint: fp || "",
      libSymbol: String(libId),
    });
  }

  const merged = new Map<string, RawBomLine>();
  for (const line of lines) {
    const k = `${line.reference}\0${line.value}\0${line.footprint}`;
    const prev = merged.get(k);
    if (prev) {
      prev.quantity = (prev.quantity ?? 1) + 1;
    } else {
      merged.set(k, { ...line, quantity: 1 });
    }
  }
  return [...merged.values()];
}

export function extractPcbStats(pcbText: string): PcbStats | null {
  const layers = pcbText.match(/\(layers[\s\S]*?\(count\s+(\d+)\)/);
  const copperLayers = layers ? parseInt(layers[1], 10) : undefined;

  let widthMm: number | undefined;
  let heightMm: number | undefined;
  const grLine = pcbText.match(/\(gr_line[\s\S]*?\(start\s+([-\d.]+)\s+([-\d.]+)\)[\s\S]*?\(end\s+([-\d.]+)\s+([-\d.]+)\)/);
  if (grLine) {
    const x1 = parseFloat(grLine[1]);
    const y1 = parseFloat(grLine[2]);
    const x2 = parseFloat(grLine[3]);
    const y2 = parseFloat(grLine[4]);
    widthMm = Math.abs(x2 - x1);
    heightMm = Math.abs(y2 - y1);
  }

  if (!copperLayers && !widthMm) return null;
  return {
    copperLayers,
    widthMm,
    heightMm,
  };
}

async function zipUncompressedSize(zip: JSZip): Promise<number> {
  let total = 0;
  zip.forEach((_, file) => {
    const u = (file as unknown as { _data?: { uncompressedSize?: number } })._data
      ?.uncompressedSize;
    total += typeof u === "number" ? u : 0;
  });
  return total;
}

export async function parseKicadZip(buffer: Buffer): Promise<KicadParseResult> {
  const zip = await JSZip.loadAsync(buffer);
  const unc = await zipUncompressedSize(zip);
  if (unc > MAX_UNCOMPRESSED_BYTES) {
    throw new Error(`Uncompressed size exceeds ${MAX_UNCOMPRESSED_BYTES} bytes`);
  }

  const fileManifest: string[] = [];
  let readmeText: string | null = null;
  const schParts: { path: string; text: string }[] = [];
  let pcbText: string | null = null;
  const projectFiles: string[] = [];

  const entries = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
  for (const path of entries.sort()) {
    fileManifest.push(path);
    const lower = path.toLowerCase();
    if (lower.endsWith("readme.md")) {
      readmeText = await zip.files[path].async("string");
    }
    if (lower.endsWith(".kicad_pro")) {
      projectFiles.push(path);
    }
    if (lower.endsWith(".kicad_sch")) {
      const t = await zip.files[path].async("string");
      schParts.push({ path, text: t });
    }
    if (lower.endsWith(".kicad_pcb") && !pcbText) {
      pcbText = await zip.files[path].async("string");
    }
  }

  const bomLines: RawBomLine[] = [];
  for (const { text } of schParts) {
    bomLines.push(...extractBomFromSchContent(text));
  }

  let pcbStats: PcbStats | null = null;
  if (pcbText) {
    pcbStats = extractPcbStats(pcbText);
  }

  return {
    fileManifest,
    readmeText,
    bomLines,
    pcbStats,
    projectFiles,
    schTextExcerpt: buildSchTextExcerpt(schParts),
    schFileExcerpts: buildSchFileExcerpts(schParts),
  };
}
