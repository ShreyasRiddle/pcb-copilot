/**
 * Shared Gemini + search tooling calls to find distributor offers for BOM lines.
 */

import { GoogleGenAI } from "@google/genai";
import type { EnrichedBomLine, RawBomLine } from "./hardwareTypes";
import { extractJson } from "./jsonExtract";

export const SOURCE_MODEL = "gemini-2.5-flash";

export interface SourceablePart {
  id?: string;
  value: string;
  type?: string;
  reasoning?: string;
  reference?: string;
}

export interface SourcingResult {
  partNumber?: string;
  price?: string;
  url?: string;
  distributor?: string;
  inStock?: boolean;
}

export async function sourcePartWithGemini(
  ai: GoogleGenAI,
  item: SourceablePart
): Promise<SourcingResult> {
  const ref = item.reference ? `Ref ${item.reference}. ` : "";
  const idPart = item.id ? `Designator ${item.id}. ` : "";

  try {
    const step3Res = await ai.models.generateContent({
      model: SOURCE_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Find a real, currently available part for this component.
${idPart}${ref}Component: ${item.value} — type: ${(item.type ?? "unknown").replace(/_/g, " ")}
Application / context: ${item.reasoning ?? "general electronics"}

Search distributors in this order: Digikey first, then Mouser, then LCSC, then Arrow.
Return the FIRST distributor that has confirmed stock.

Prefer parts with:
- Confirmed in-stock availability
- Common package (0402, 0603, SOT-23, SOIC, etc.)
- Reasonable price for qty 1

Return ONLY raw JSON (no markdown, no code fences):
{"partNumber": "string", "price": "$X.XX", "url": "https://...", "distributor": "Digikey", "inStock": true}

If all distributors are out of stock or you cannot find a suitable part:
{"partNumber": "N/A", "price": "N/A", "url": "", "distributor": "none", "inStock": false}`,
            },
          ],
        },
      ],
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const step3Text = step3Res.text ?? "{}";
    return extractJson<SourcingResult>(step3Text, {});
  } catch {
    return {};
  }
}

function inferTypeFromRef(ref: string): string {
  const r = ref.toUpperCase();
  const first = r.replace(/[^A-Z]/g, "").charAt(0);
  if (first === "R") return "resistor";
  if (first === "C") return "capacitor_ceramic";
  if (first === "L") return "inductor";
  if (first === "D") return "diode";
  if (first === "Q") return "mosfet";
  if (first === "U" || first === "IC") return "ic";
  return "passive_or_misc";
}

const DEFAULT_SOURCING_CONCURRENCY = 4;
const MAX_SOURCING_CONCURRENCY = 8;

function sourcingConcurrency(): number {
  const raw = process.env.HARDWARE_SOURCING_CONCURRENCY;
  if (raw === undefined || raw === "") return DEFAULT_SOURCING_CONCURRENCY;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_SOURCING_CONCURRENCY;
  return Math.min(n, MAX_SOURCING_CONCURRENCY);
}

/** Run async tasks with a bounded pool (order of completion varies; results indexed by line). */
async function runPool<T>(factories: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array(factories.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= factories.length) return;
      results[i] = await factories[i]();
    }
  }

  const workers = Math.min(Math.max(1, limit), Math.max(1, factories.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

export async function enrichHardwareBomLines(
  lines: RawBomLine[],
  apiKey: string
): Promise<EnrichedBomLine[]> {
  const ai = new GoogleGenAI({ apiKey });
  const limit = sourcingConcurrency();

  const factories = lines.map(
    (line) => () =>
      (async () => {
        const type = inferTypeFromRef(line.reference);
        const reasoning = `Schematic ref ${line.reference}. Footprint: ${line.footprint || "n/a"}. Lib: ${line.libSymbol || "n/a"}.`;
        const s = await sourcePartWithGemini(ai, {
          reference: line.reference,
          value: line.value || line.reference,
          type,
          reasoning,
        });
        return {
          ...line,
          partNumber: s.partNumber,
          price: s.price,
          url: s.url,
          distributor: s.distributor,
          inStock: s.inStock !== false,
        } satisfies EnrichedBomLine;
      })()
  );

  return runPool(factories, limit);
}
