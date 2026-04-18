/**
 * Full AI pipeline — runs when ANTHROPIC_API_KEY is set and a PDF is uploaded.
 * Steps: 1) Parse datasheet, 2) Calculate design values, 3) Source parts, 4) Build scene graph
 */

import Anthropic from "@anthropic-ai/sdk";
import { SceneComponent } from "./types";
import { DEMO_TRACES } from "./demoScene";
import { buildSceneGraph } from "./buildSceneGraph";

interface PipelineArgs {
  prompt: string;
  specs: { vin: string; vout: string; iout: string };
  pdfBase64: string;
  apiKey: string;
  send: (data: object) => void;
}

export async function runPipeline({ prompt, specs, pdfBase64, apiKey, send }: PipelineArgs) {
  const client = new Anthropic({ apiKey });

  // ── Step 1: Parse datasheet ──────────────────────────────────────────────
  send({ type: "status", message: "Reading datasheet…" });

  const datasheetResult = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
          } as Anthropic.DocumentBlockParam,
          {
            type: "text",
            text: `Extract the following from this IC datasheet as JSON only (no markdown):
{
  "topology": "string (e.g. synchronous buck)",
  "equations": ["list of design equations as strings"],
  "pins": [{"name": "string", "number": number, "function": "string"}],
  "appCircuit": "string describing the typical application circuit components"
}

User specs: Vin=${specs.vin}V, Vout=${specs.vout}V, Iout=${specs.iout}A`,
          },
        ],
      },
    ],
  });

  const datasheetText = datasheetResult.content[0].type === "text" ? datasheetResult.content[0].text : "{}";
  let datasheetData: { topology?: string; equations?: string[] } = {};
  try {
    datasheetData = JSON.parse(datasheetText);
  } catch {
    datasheetData = { topology: "buck converter", equations: [] };
  }

  // ── Step 2: Calculate component values ────────────────────────────────────
  send({ type: "status", message: "Calculating component values…" });

  const calcResult = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Given this ${datasheetData.topology || "buck converter"} with specs Vin=${specs.vin}V, Vout=${specs.vout}V, Iout=${specs.iout}A, fsw=500kHz:

Design equations: ${JSON.stringify(datasheetData.equations || [])}

Calculate all required passive component values. Return ONLY a JSON array:
[
  {"id": "R1", "type": "resistor", "value": "100kΩ", "reasoning": "upper feedback divider"},
  {"id": "R2", "type": "resistor", "value": "22.1kΩ", "reasoning": "lower feedback divider, Vout = Vref*(1+R1/R2)"},
  {"id": "L1", "type": "inductor", "value": "4.7µH", "reasoning": "output inductor at 500kHz"},
  {"id": "Cin", "type": "capacitor_ceramic", "value": "10µF", "reasoning": "input decoupling"},
  {"id": "Cout", "type": "capacitor_ceramic", "value": "47µF", "reasoning": "output filter"},
  {"id": "Cboot", "type": "capacitor_ceramic", "value": "100nF", "reasoning": "bootstrap cap"}
]

Use exact types: resistor, capacitor_ceramic, capacitor_electrolytic, inductor, ic`,
      },
    ],
  });

  const calcText = calcResult.content[0].type === "text" ? calcResult.content[0].text : "[]";
  let bomItems: Array<{ id: string; type: string; value: string; reasoning: string }> = [];
  try {
    const match = calcText.match(/\[[\s\S]*\]/);
    if (match) bomItems = JSON.parse(match[0]);
  } catch {
    bomItems = [];
  }

  // ── Step 3: Source parts (parallel) ───────────────────────────────────────
  send({ type: "status", message: "Sourcing parts on Digikey…" });

  const sourced = await Promise.all(
    bomItems.map(async (item) => {
      send({ type: "status", message: `Sourcing ${item.id} (${item.value})…` });
      try {
        const res = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 512,
          tools: [
            {
              type: "web_search_20250305" as "web_search_20250305",
              name: "web_search",
            },
          ],
          messages: [
            {
              role: "user",
              content: `Find a real Digikey part for: ${item.value} ${item.type.replace("_", " ")} for a ${specs.vout}V/${specs.iout}A buck converter. Return JSON only:
{"partNumber": "string", "price": "$X.XX", "url": "https://digikey.com/...", "inStock": true, "distributor": "Digikey", "package": "string"}`,
            },
          ],
        });

        const text = res.content.find((c) => c.type === "text")?.text || "{}";
        const match = text.match(/\{[\s\S]*\}/);
        return { ...item, ...(match ? JSON.parse(match[0]) : {}) };
      } catch {
        return item;
      }
    })
  );

  // ── Step 4: Build scene graph (algorithmic) ───────────────────────────────
  send({ type: "status", message: "Placing components on board…" });
  const sceneGraph = buildSceneGraph(sourced as SceneComponent[]);

  send({ type: "status", message: "Done." });
  send({ type: "result", sceneGraph, traces: DEMO_TRACES });
}
