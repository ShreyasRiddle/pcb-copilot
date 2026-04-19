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
  return lines.map((line) => {
    const id = (line.reference || "?").trim() || "?";
    const type = inferComponentType(line);
    const enriched = line as EnrichedBomLine;
    const hasPn = Boolean(enriched.partNumber && enriched.partNumber !== "N/A");
    const item: HardwareWiringBomItem = {
      id,
      type,
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
    return item;
  });
}
