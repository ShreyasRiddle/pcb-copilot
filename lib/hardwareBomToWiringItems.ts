import { buildWiringGraph } from "./buildWiringGraph";
import type { EnrichedBomLine, RawBomLine } from "./hardwareTypes";

/** Single BOM row shape accepted by `buildWiringGraph` (matches internal EnrichedBOMItem). */
export type HardwareWiringBomItem = Parameters<typeof buildWiringGraph>[0][number];

function inferComponentType(line: RawBomLine): string {
  const ref = line.reference || "";
  const lib = (line.libSymbol || "").toLowerCase();
  const fp = (line.footprint || "").toLowerCase();

  if (/^U\d|^IC\d/i.test(ref)) return "ic";
  if (
    lib.includes("regulator") ||
    lib.includes("ldo") ||
    lib.includes("dcdc") ||
    lib.includes(":mcu") ||
    lib.includes("stm32") ||
    lib.includes("esp32") ||
    lib.includes("micro:") ||
    lib.includes("mcu:")
  ) {
    return "ic";
  }
  if (/device:r|\.r\b|:r\b|resistor/i.test(lib) || fp.includes("_r") || /^r\d/i.test(ref)) {
    return "resistor";
  }
  if (/device:c|\.c\b|:c\b|capacitor|cap_/i.test(lib) || fp.includes("_c") || /^c\d/i.test(ref)) {
    return "capacitor_ceramic";
  }
  if (/device:l|inductor|\.l\b|:l\b/i.test(lib) || fp.includes("_l") || /^l\d/i.test(ref)) {
    return "inductor";
  }
  if (/diode/i.test(lib) || /^d\d/i.test(ref)) return "diode";
  if (/mosfet|fet|transistor/i.test(lib) || /^q\d/i.test(ref)) return "mosfet";
  if (/^u\d/i.test(ref)) return "ic";
  return "resistor";
}

function labelFor(line: RawBomLine): string {
  const ref = line.reference || "?";
  const v = (line.value || "").trim();
  if (!v) return ref;
  return `${ref}\n${v}`;
}

/**
 * Map KiCad BOM lines (raw or enriched) into items for `buildWiringGraph`.
 * `id` is the schematic reference (must match connection `from` / `to`).
 */
export function hardwareBomLinesToWiringBomItems(
  lines: (RawBomLine & Partial<EnrichedBomLine>)[]
): HardwareWiringBomItem[] {
  // Multiple schematic files can legitimately repeat the same reference designator
  // (e.g. hierarchical sheets or power symbols). The wiring diagram requires unique node ids,
  // so we dedupe by reference and keep the “best” available info.
  const byId = new Map<string, HardwareWiringBomItem>();
  const seenCount = new Map<string, number>();

  for (const line of lines) {
    const rawId = (line.reference || "?").trim() || "?";
    const id = rawId;
    seenCount.set(id, (seenCount.get(id) ?? 0) + 1);

    const enriched = line as EnrichedBomLine;
    const next: HardwareWiringBomItem = {
      id,
      type: inferComponentType(line),
      label: labelFor(line),
      value: line.value || "",
      reasoning: enriched.notes || undefined,
      partNumber: enriched.partNumber,
      price: enriched.price,
      url: enriched.url,
      distributor: enriched.distributor,
      inStock: enriched.inStock,
      backordered: enriched.inStock === false,
    };

    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, next);
      continue;
    }

    // Prefer entries with richer details (part number / URL / price), otherwise keep the first.
    const prevScore =
      (prev.partNumber && prev.partNumber !== "N/A" ? 2 : 0) +
      (prev.url ? 1 : 0) +
      (prev.price ? 1 : 0);
    const nextScore =
      (next.partNumber && next.partNumber !== "N/A" ? 2 : 0) +
      (next.url ? 1 : 0) +
      (next.price ? 1 : 0);

    if (nextScore > prevScore) byId.set(id, next);
  }

  const out = [...byId.values()];
  // If a ref appeared multiple times, annotate the label so users understand it was merged.
  for (const item of out) {
    const n = seenCount.get(item.id) ?? 1;
    if (n > 1) {
      item.label = `${item.label}\n(x${n})`;
    }
  }
  return out;
}
