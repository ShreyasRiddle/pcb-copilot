import Anthropic from "@anthropic-ai/sdk";
import { SceneComponent } from "./types";
import { buildSceneGraph, buildTraces } from "./buildSceneGraph";

interface PipelineArgs {
  prompt: string;
  specs: { vin: string; vout: string; iout: string };
  pdfBase64: string;
  apiKey: string;
  send: (data: object) => void;
}

/** Safely parse JSON from Claude's text — handles markdown code fences */
function safeParseJSON<T>(text: string, fallback: T): T {
  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/```(?:json)?\n?/g, "").trim();
    // Extract first JSON object or array
    const match = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (match) return JSON.parse(match[0]) as T;
  } catch {
    // fall through
  }
  return fallback;
}

export async function runPipeline({ prompt, specs, pdfBase64, apiKey, send }: PipelineArgs) {
  const client = new Anthropic({ apiKey });

  // ── Step 1: Parse datasheet ──────────────────────────────────────────────
  send({ type: "status", message: "Reading datasheet…" });

  let datasheetData: { topology?: string; equations?: string[]; appCircuit?: string } = {
    topology: "switching regulator",
    equations: [],
    appCircuit: "",
  };

  try {
    const datasheetResult = await client.messages.create({
      model: "claude-sonnet-4-5",
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
              text: `Extract from this IC datasheet as JSON only (no markdown, no explanation):
{
  "topology": "e.g. synchronous buck, LDO, boost",
  "equations": ["list key design equations as plain strings"],
  "appCircuit": "brief description of the typical application circuit and components needed"
}

User specs: Vin=${specs.vin}V, Vout=${specs.vout}V, Iout=${specs.iout}A`,
            },
          ],
        },
      ],
    });

    const text = datasheetResult.content[0].type === "text" ? datasheetResult.content[0].text : "";
    datasheetData = safeParseJSON(text, datasheetData);
  } catch (err) {
    send({ type: "status", message: "Datasheet parse warning — using defaults…" });
  }

  // ── Step 2: Calculate component values ────────────────────────────────────
  send({ type: "status", message: "Calculating component values…" });

  type BOMItem = { id: string; type: string; value: string; reasoning: string };
  let bomItems: BOMItem[] = [];

  try {
    const calcResult = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are a circuit design engineer. Given a ${datasheetData.topology || "switching regulator"} with:
- Vin = ${specs.vin}V, Vout = ${specs.vout}V, Iout = ${specs.iout}A, fsw = 500kHz
- Design equations: ${JSON.stringify(datasheetData.equations)}
- Application circuit notes: ${datasheetData.appCircuit}

Calculate ALL required passive component values. Return ONLY a JSON array, no markdown:
[
  {"id": "U1", "type": "ic", "value": "<IC name>", "reasoning": "main controller"},
  {"id": "R1", "type": "resistor", "value": "100kΩ", "reasoning": "upper feedback resistor — Vout = Vref*(1+R1/R2)"},
  {"id": "R2", "type": "resistor", "value": "22.1kΩ", "reasoning": "lower feedback resistor"},
  {"id": "L1", "type": "inductor", "value": "4.7µH", "reasoning": "output inductor — L=(Vin-Vout)/(ΔIL*fsw)"},
  {"id": "Cin", "type": "capacitor_ceramic", "value": "10µF 25V", "reasoning": "input decoupling"},
  {"id": "Cout", "type": "capacitor_ceramic", "value": "47µF 10V", "reasoning": "output filter"},
  {"id": "Cboot", "type": "capacitor_ceramic", "value": "100nF", "reasoning": "bootstrap cap"}
]

Valid types: resistor, capacitor_ceramic, capacitor_electrolytic, inductor, ic
Include the IC itself as the first item with type "ic".`,
        },
      ],
    });

    const text = calcResult.content[0].type === "text" ? calcResult.content[0].text : "[]";
    bomItems = safeParseJSON<BOMItem[]>(text, []);
  } catch (err) {
    send({ type: "status", message: "Calculation error — using estimated values…" });
    // Fallback BOM based on specs
    bomItems = [
      { id: "U1",    type: "ic",               value: "IC",      reasoning: "Main controller" },
      { id: "L1",    type: "inductor",          value: "4.7µH",  reasoning: "Output inductor" },
      { id: "Cin",   type: "capacitor_ceramic", value: "10µF",   reasoning: "Input decoupling" },
      { id: "Cout",  type: "capacitor_ceramic", value: "47µF",   reasoning: "Output filter" },
      { id: "R1",    type: "resistor",          value: "100kΩ",  reasoning: "Upper feedback" },
      { id: "R2",    type: "resistor",          value: "22.1kΩ", reasoning: "Lower feedback" },
      { id: "Cboot", type: "capacitor_ceramic", value: "100nF",  reasoning: "Bootstrap cap" },
    ];
  }

  // ── Step 3: Source parts (parallel) ───────────────────────────────────────
  send({ type: "status", message: `Sourcing ${bomItems.length} parts on Digikey…` });

  type SourcingData = { partNumber?: string; price?: string; url?: string; inStock?: boolean; distributor?: string; package?: string };

  const sourced = await Promise.all(
    bomItems.map(async (item): Promise<BOMItem & SourcingData> => {
      send({ type: "status", message: `Sourcing ${item.id} — ${item.value}…` });
      try {
        const res = await client.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 1024,
          tools: [
            {
              type: "web_search_20250305" as "web_search_20250305",
              name: "web_search",
            },
          ],
          messages: [
            {
              role: "user",
              content: `Search Digikey for a real in-stock part: "${item.value} ${item.type.replace(/_/g, " ")}" suitable for a ${specs.vout}V/${specs.iout}A power supply.

Return ONLY this JSON, no other text:
{"partNumber":"string","price":"$X.XX","url":"https://www.digikey.com/...","inStock":true,"distributor":"Digikey","package":"string"}`,
            },
          ],
        });

        const textBlock = res.content.find((c) => c.type === "text");
        const text = textBlock?.type === "text" ? textBlock.text : "{}";
        const sourcing = safeParseJSON<SourcingData>(text, {});
        return { ...item, ...sourcing };
      } catch {
        return item; // Return without sourcing if it fails
      }
    })
  );

  // ── Step 4: Build scene graph ─────────────────────────────────────────────
  send({ type: "status", message: "Placing components on board…" });
  const sceneGraph = buildSceneGraph(sourced as Partial<SceneComponent>[]);
  const traces = buildTraces(sceneGraph);

  // ── Step 5: Assembly instructions ────────────────────────────────────────
  send({ type: "status", message: "Generating assembly instructions…" });

  let assemblySteps: { stepNumber: number; instruction: string; componentId: string }[] = [];

  try {
    const assemblyResult = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Given this BOM for a ${datasheetData.topology || "circuit"}: ${JSON.stringify(
            sceneGraph.map((c) => ({ id: c.id, value: c.value, type: c.type }))
          )}

Generate ordered PCB assembly steps. Return ONLY a JSON array, no markdown:
[
  {"stepNumber": 1, "instruction": "Place and solder U1 (IC) first — it sets the alignment for all other components", "componentId": "U1"},
  {"stepNumber": 2, "instruction": "Solder R1 and R2 feedback resistors — these set the output voltage", "componentId": "R1"},
  ...
]`,
        },
      ],
    });

    const text = assemblyResult.content[0].type === "text" ? assemblyResult.content[0].text : "[]";
    assemblySteps = safeParseJSON(text, []);
  } catch {
    // Non-critical — skip assembly steps if it fails
  }

  send({ type: "status", message: "Done." });
  send({ type: "result", sceneGraph, traces, assemblySteps });
}
