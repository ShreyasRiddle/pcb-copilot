/**
 * Smart AI pipeline — Google Gemini
 *
 * Step 0  (text only)  Clarification check — if the prompt is too vague, emit a
 *                      "question" SSE event and stop. The client shows a UI, the user
 *                      answers, and the frontend re-POSTs with the enriched prompt.
 *
 * Step 1a (text only)  Interpret the circuit description — pick ICs, describe topology.
 * Step 1b (PDF)        Parse the datasheet PDF — extract topology, equations, pin info.
 *
 * Step 2               Generate a generic BOM **and** a netlist (connections array).
 *                      This replaces the hardcoded BUCK_CONNECTIONS in buildWiringGraph.
 *
 * Step 3               Source each part — Digikey first, then Mouser, then LCSC, then Arrow.
 *
 * Step 4               buildWiringGraph (algorithmic) using the AI-generated netlist.
 */

import { GoogleGenAI } from "@google/genai";
import { WiringGraph } from "./types";
import { buildWiringGraph } from "./buildWiringGraph";

const MODEL = "gemini-2.5-flash";

export interface AIConnection {
  code: string;
  label: string;
  from: string;
  fromPin: string;
  to: string;
  toPin: string;
  net: string;
  awg?: number;
}

interface PipelineArgs {
  prompt: string;
  specs: { vin: string; vout: string; iout: string };
  pdfBase64?: string;
  apiKey: string;
  send: (data: object) => void;
}

interface BOMItem {
  id: string;
  type: string;
  label?: string;
  value: string;
  reasoning: string;
  partNumber?: string;
  price?: string;
  url?: string;
  distributor?: string;
  inStock?: boolean;
  backordered?: boolean;
}

function extractJson<T>(text: string, fallback: T): T {
  // Strip markdown code fences if present
  const stripped = text.replace(/```(?:json)?[\s\S]*?```/g, (m) =>
    m.replace(/```(?:json)?/g, "").replace(/```$/, "")
  );
  try {
    return JSON.parse(stripped.trim()) as T;
  } catch {
    const arrMatch = stripped.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try { return JSON.parse(arrMatch[0]) as T; } catch { /* fall through */ }
    }
    const objMatch = stripped.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]) as T; } catch { /* fall through */ }
    }
    return fallback;
  }
}

/** Build a concise spec string if the user provided numbers */
function specLine(specs: { vin: string; vout: string; iout: string }): string {
  const parts: string[] = [];
  if (specs.vin)  parts.push(`Vin=${specs.vin}V`);
  if (specs.vout) parts.push(`Vout=${specs.vout}V`);
  if (specs.iout) parts.push(`Iout=${specs.iout}A`);
  return parts.length ? parts.join(", ") : "";
}

export async function runPipeline({
  prompt,
  specs,
  pdfBase64,
  apiKey,
  send,
}: PipelineArgs): Promise<void> {
  const ai = new GoogleGenAI({ apiKey });
  const sl = specLine(specs);

  // ── Step 0: Clarification check (text-only prompts only) ──────────────────
  if (!pdfBase64) {
    send({ type: "status", step: 1, message: "Evaluating prompt…" });

    const step0Res = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a PCB design assistant.
Evaluate if this circuit design prompt has enough information to produce a realistic component BOM and wiring diagram.

Prompt: "${prompt}"
${sl ? `Specs: ${sl}` : ""}

A prompt is SUFFICIENT if it clearly describes either:
- A specific IC (e.g. "TPS563201 buck converter", "L298N motor driver", "NE555 astable oscillator", "LM358 op-amp amplifier")
- A well-defined functional block with key parameters (supply voltage, current, gain, frequency, etc.)

A prompt is INSUFFICIENT when it only names a system or application without specifying key electrical parameters
(e.g. "RC car", "robot arm", "LED strip controller", "power supply").

When INSUFFICIENT, generate targeted clarifying questions. Questions should have 3-5 short option chips plus an "Other" option.
Keep questions concise. Use domain-correct terminology.

Return ONLY raw JSON — no markdown, no code fences:

If sufficient:
{"sufficient": true}

If insufficient:
{"sufficient": false, "questions": [
  {"id": "ic", "text": "Which driver IC? (I can recommend one)", "options": ["Recommend for me", "L298N", "DRV8833", "TB6612FNG", "Other"]},
  {"id": "voltage", "text": "Supply voltage?", "options": ["3.3V", "5V", "7.4V LiPo", "12V", "Other"]},
  {"id": "current", "text": "Load current per channel?", "options": ["< 0.5A", "0.5–1A", "1–2A", "> 2A", "Other"]}
]}`,
            },
          ],
        },
      ],
    });

    const step0Text = step0Res.text ?? "{}";
    const assessment = extractJson<{
      sufficient: boolean;
      questions?: Array<{ id: string; text: string; options?: string[] }>;
    }>(step0Text, { sufficient: true });

    if (!assessment.sufficient && assessment.questions?.length) {
      send({ type: "question", questions: assessment.questions });
      return;
    }
  }

  // ── Step 1: Interpret circuit description ─────────────────────────────────
  send({ type: "status", step: 1, message: "Interpreting circuit description…" });

  let topologyData: { topology?: string; mainIC?: string; equations?: string[]; description?: string } = {};

  if (pdfBase64) {
    // 1b — PDF path: parse the datasheet
    send({ type: "status", step: 1, message: "Parsing datasheet PDF…" });

    const step1Res = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
            {
              text: `Extract the following from this IC datasheet as raw JSON only (no markdown, no code fences):
{
  "topology": "string (e.g. synchronous buck, H-bridge motor driver)",
  "mainIC": "string (IC part number / name)",
  "equations": ["key design equations as strings"],
  "description": "one paragraph describing the typical application circuit"
}
${sl ? `User specs: ${sl}` : ""}
${prompt ? `User notes: ${prompt}` : ""}`,
            },
          ],
        },
      ],
    });

    topologyData = extractJson(step1Res.text ?? "{}", {});
  } else {
    // 1a — text-only path: use Gemini's knowledge of common ICs
    send({ type: "status", step: 1, message: "Identifying components from description…" });

    const step1Res = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are an electronics engineer with expert knowledge of common ICs and reference designs.

Circuit description: "${prompt}"
${sl ? `Specs: ${sl}` : ""}

Based on this description, identify the best IC(s) and describe the standard application circuit.
If the user said "Recommend for me" for an IC, choose the most appropriate, commonly available IC.

Return ONLY raw JSON (no markdown, no code fences):
{
  "topology": "string describing the circuit topology",
  "mainIC": "string (recommended IC part number or 'multiple')",
  "equations": ["relevant design equations or rules of thumb"],
  "description": "paragraph describing the complete typical application circuit with all necessary passive components"
}`,
            },
          ],
        },
      ],
    });

    topologyData = extractJson(step1Res.text ?? "{}", {});
  }

  // ── Step 2: Generate BOM + netlist ────────────────────────────────────────
  send({ type: "status", step: 2, message: "Calculating component values and netlist…" });

  const step2Res = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are an electronics engineer designing a PCB.

Circuit: ${topologyData.topology ?? "the described circuit"}
Main IC: ${topologyData.mainIC ?? "as described"}
${sl ? `Specs: ${sl}` : ""}
${topologyData.description ? `Description: ${topologyData.description}` : ""}
${topologyData.equations?.length ? `Design equations: ${topologyData.equations.join("; ")}` : ""}
User prompt: "${prompt}"

Generate a complete, minimal BOM and a wiring netlist.

IMPORTANT rules:
- Use realistic component IDs: U1 (IC), C1/C2/Cin/Cout (caps), R1/R2 (resistors), L1 (inductor), D1 (diode), Q1 (transistor), etc.
- Use the EXACT same IDs in both components and connections.
- Each connection needs a unique short code (A, B, C, …).
- Net labels should be descriptive (VIN, GND, VOUT, SW, FB, EN, BOOT, IN_A, IN_B, OUT_A, etc.).
- awg: use 20 for power rails, 24 for signal lines.
- Include only real passive components that appear in a typical reference design schematic — no extras.
- For the label field of an IC, use "ID\\nPartNumber" (newline between ref and part number).

Return ONLY raw JSON (no markdown, no code fences):
{
  "components": [
    {"id": "U1",  "type": "ic",               "label": "U1\\nTPS563201", "value": "TPS563201",     "reasoning": "main switching IC"},
    {"id": "Cin", "type": "capacitor_ceramic", "label": "Cin",           "value": "10µF 25V X5R",  "reasoning": "input decoupling"},
    {"id": "L1",  "type": "inductor",          "label": "L1",            "value": "4.7µH 3A",      "reasoning": "output filter inductor"},
    {"id": "Cout","type": "capacitor_ceramic", "label": "Cout",          "value": "47µF 10V X5R",  "reasoning": "output filter cap"},
    {"id": "R1",  "type": "resistor",          "label": "R1",            "value": "100kΩ",         "reasoning": "upper feedback divider"},
    {"id": "R2",  "type": "resistor",          "label": "R2",            "value": "22.1kΩ",        "reasoning": "lower feedback divider"},
    {"id": "Cboot","type":"capacitor_ceramic", "label": "Cboot",         "value": "100nF",         "reasoning": "bootstrap cap"}
  ],
  "connections": [
    {"code": "A", "label": "VIN",     "from": "Cin", "fromPin": "P+",  "to": "U1",   "toPin": "VIN",  "net": "VIN",  "awg": 20},
    {"code": "B", "label": "GND",     "from": "Cin", "fromPin": "P-",  "to": "U1",   "toPin": "GND",  "net": "GND",  "awg": 20},
    {"code": "C", "label": "SW",      "from": "U1",  "fromPin": "SW",  "to": "L1",   "toPin": "P1",   "net": "SW",   "awg": 24},
    {"code": "D", "label": "VOUT",    "from": "L1",  "fromPin": "P2",  "to": "Cout", "toPin": "P+",   "net": "VOUT", "awg": 24},
    {"code": "E", "label": "VOUT_FB", "from": "Cout","fromPin": "P+",  "to": "R1",   "toPin": "P1",   "net": "VOUT", "awg": 24},
    {"code": "F", "label": "FB",      "from": "R1",  "fromPin": "P2",  "to": "R2",   "toPin": "P1",   "net": "FB",   "awg": 24},
    {"code": "G", "label": "FB_PIN",  "from": "R1",  "fromPin": "P2",  "to": "U1",   "toPin": "FB",   "net": "FB",   "awg": 24},
    {"code": "H", "label": "GND_FB",  "from": "R2",  "fromPin": "P2",  "to": "Cout", "toPin": "P-",   "net": "GND",  "awg": 24},
    {"code": "I", "label": "BOOT",    "from": "U1",  "fromPin": "SW",  "to": "Cboot","toPin": "P1",   "net": "BOOT", "awg": 24},
    {"code": "J", "label": "BOOT_PIN","from": "Cboot","fromPin":"P2",  "to": "U1",   "toPin": "BOOT", "net": "BOOT", "awg": 24}
  ]
}`,
          },
        ],
      },
    ],
  });

  const step2Data = extractJson<{
    components?: BOMItem[];
    connections?: AIConnection[];
  }>(step2Res.text ?? "{}", {});

  const bomItems: BOMItem[] = step2Data.components ?? [];
  const aiConnections: AIConnection[] = step2Data.connections ?? [];

  if (bomItems.length === 0) {
    throw new Error("Step 2 returned no components — check your prompt or datasheet.");
  }

  // ── Step 3: Multi-distributor sourcing ────────────────────────────────────
  send({ type: "status", step: 3, message: "Sourcing components…" });

  const sourced = await Promise.all(
    bomItems.map(async (item): Promise<BOMItem> => {
      send({
        type: "status",
        step: 3,
        message: `Sourcing ${item.id} (${item.value})…`,
      });

      try {
        const step3Res = await ai.models.generateContent({
          model: MODEL,
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Find a real, currently available part for this component.
Component: ${item.value} — type: ${item.type.replace(/_/g, " ")}
Application: ${item.reasoning ?? "general electronics"}

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
        const sourcing = extractJson<{
          partNumber?: string;
          price?: string;
          url?: string;
          distributor?: string;
          inStock?: boolean;
        }>(step3Text, {});

        return {
          ...item,
          partNumber: sourcing.partNumber,
          price: sourcing.price,
          url: sourcing.url,
          distributor: sourcing.distributor,
          inStock: sourcing.inStock !== false,
          backordered: sourcing.inStock === false,
        };
      } catch {
        return { ...item, inStock: false, backordered: false };
      }
    })
  );

  // ── Step 4: Build wiring diagram ──────────────────────────────────────────
  send({ type: "status", step: 4, message: "Building wiring diagram…" });

  const wiringGraph: WiringGraph = buildWiringGraph(sourced, aiConnections);

  send({ type: "result", data: wiringGraph });
}
