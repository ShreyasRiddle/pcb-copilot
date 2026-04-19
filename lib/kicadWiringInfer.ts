import { GoogleGenAI } from "@google/genai";
import { extractJson } from "./jsonExtract";
import type { AIConnection } from "./pipeline";

const MODEL = "gemini-2.5-flash";

/**
 * Ask Gemini to infer schematic connectivity from KiCad S-expressions.
 * Only returns edges whose `from`/`to` exist in `refs`.
 */
export async function inferKicadConnections(
  refs: string[],
  schTextExcerpt: string,
  apiKey: string
): Promise<AIConnection[]> {
  if (refs.length === 0 || !schTextExcerpt.trim()) return [];

  const refSet = new Set(refs);
  const ai = new GoogleGenAI({ apiKey });

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are parsing KiCad 6+ schematic files (S-expression). Infer electrical connections between placed symbols.

Rules:
- Use ONLY these reference designators as "from" and "to" (exact spelling): ${refs.join(", ")}
- Each connection: code (single letter A-Z then AA… if needed), label (human net name), from, fromPin, to, toPin, net, awg (20 for power, 24 for signal).
- Pin names: use KiCad pin numbers like "1","2" or pin names from the symbol if visible in the excerpt.
- Prefer nets implied by (label ...), (global_label ...), power symbols, and (wire ...) topology.
- If you cannot justify a link from the excerpt, omit it — do not invent refs outside the list.

Return ONLY raw JSON (no markdown):
{"connections":[{"code":"A","label":"VIN","from":"C1","fromPin":"1","to":"U1","toPin":"VIN","net":"VIN","awg":20}]}

Schematic excerpt (may be truncated):
${schTextExcerpt}`,
          },
        ],
      },
    ],
  });

  const data = extractJson<{ connections?: AIConnection[] }>(res.text ?? "{}", {});
  const raw = data.connections ?? [];
  return raw
    .filter(
      (c) =>
        refSet.has(c.from) &&
        refSet.has(c.to) &&
        typeof c.fromPin === "string" &&
        c.fromPin.length > 0 &&
        typeof c.toPin === "string" &&
        c.toPin.length > 0 &&
        typeof c.net === "string"
    )
    .map((c, i): AIConnection => ({
      code:
        typeof c.code === "string" && c.code.length > 0
          ? c.code
          : String.fromCharCode(65 + (i % 26)),
      label: typeof c.label === "string" && c.label.length > 0 ? c.label : c.net,
      from: c.from,
      fromPin: c.fromPin,
      to: c.to,
      toPin: c.toPin,
      net: c.net,
      awg: typeof c.awg === "number" ? c.awg : undefined,
    }));
}
