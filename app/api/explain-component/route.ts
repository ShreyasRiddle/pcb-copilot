/**
 * POST /api/explain-component
 * Body: { label, value, reasoning, circuitDescription }
 *
 * Streams a plain-text SSE explanation of:
 *   1. What this component does in the circuit
 *   2. Why this specific value was chosen (formula shown)
 *   3. What breaks if the value is wrong
 *
 * Events:
 *   { type: "chunk", text: string }   — streaming text fragment
 *   { type: "done" }                  — stream complete
 *   { type: "error", message: string }
 */

import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-2.5-flash";

function sse(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { label, value, reasoning, circuitDescription } =
          await req.json();
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
          controller.enqueue(
            sse({ type: "error", message: "No GEMINI_API_KEY configured." })
          );
          return;
        }

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `You are an electronics engineer explaining one PCB component to a motivated beginner.

Circuit context: ${circuitDescription ?? "a general electronic circuit"}

Component:
- Reference: ${label ?? "unknown"}
- Value / part: ${value ?? "unknown"}
- Design note from the design tool: ${reasoning ?? "none"}

You MUST output using EXACTLY this structure and these three line markers on their own lines (copy them verbatim):

<<<ROLE>>>
2–3 short sentences: what this part does in the circuit (energy storage, filtering, feedback, gate drive, etc.). No section title inside the body.

<<<MATH>>>
Always include at least one concrete relationship: an equation, time constant, impedance rule, or numerical check (e.g. τ = R×C, |Z| = 1/(2πfC), Vout = Vref×(1+R1/R2), or a typical range like 0.1 µF for bootstrap). Use Unicode × for multiply if needed. If the value is mainly from the datasheet, still give one formula the designer would use nearby (e.g. minimum capacitance vs switching frequency).

<<<RISK>>>
One punchy sentence: the main symptom if this part is wrong, missing, or fails.

Rules:
- No markdown (#, **, bullets). Plain sentences only inside each block.
- Total under 180 words.
- Do not repeat the words "Section 1" or "WHAT IT DOES" in the output — only the markers <<<ROLE>>>, <<<MATH>>>, <<<RISK>>>.`;

        const result = await ai.models.generateContentStream({
          model: MODEL,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        for await (const chunk of result) {
          const text = chunk.text;
          if (text) {
            controller.enqueue(sse({ type: "chunk", text }));
          }
        }

        controller.enqueue(sse({ type: "done" }));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(sse({ type: "error", message }));
      } finally {
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
