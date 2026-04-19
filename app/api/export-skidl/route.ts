/**
 * POST /api/export-skidl
 * Body: { wiringGraph: WiringGraph }
 *
 * Streams SSE events:
 *   { type: "status", message: string }
 *   { type: "result", script: string, netlist?: string, error?: string, log: string[] }
 *
 * Uses Gemini to generate a proper SKiDL script (SKIDL tool, explicit pins),
 * then iteratively runs it with Python and repairs errors until ERC passes
 * or max iterations (3) are reached.
 *
 * Requires Python 3 + SKiDL installed (see Dockerfile).
 */

import { NextRequest } from "next/server";
import { WiringGraph } from "@/lib/types";
import { generateInitialScript, runAndRepair } from "@/lib/skidlRepair";

function sseEvent(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export const maxDuration = 180; // 3 minute timeout for the repair loop

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => controller.enqueue(sseEvent(data));

      try {
        const body = await req.json();
        const wiringGraph = body.wiringGraph as WiringGraph;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
          send({ type: "result", error: "No GEMINI_API_KEY configured.", log: [], script: "" });
          return;
        }

        if (!wiringGraph?.nodes?.length) {
          send({ type: "result", error: "No wiring graph provided.", log: [], script: "" });
          return;
        }

        // Step 1: Generate initial script with Gemini
        send({ type: "status", message: "Generating SKiDL script with Gemini…" });
        const initialScript = await generateInitialScript(wiringGraph, apiKey);

        // Step 2: Run + iterative repair loop
        const result = await runAndRepair(
          initialScript,
          apiKey,
          (msg) => send({ type: "status", message: msg }),
          3
        );

        // Step 3: Return result
        if (result.success) {
          send({
            type: "result",
            script: result.script,
            netlist: result.netlist,
            log: result.log,
          });
        } else {
          send({
            type: "result",
            script: result.script,
            error:
              "ERC did not fully pass after 3 repair attempts — script downloaded for manual review.",
            log: result.log,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ type: "result", error: message, log: [], script: "" });
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
