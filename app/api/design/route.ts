import { NextRequest } from "next/server";
import { DEMO_SCENE, DEMO_TRACES, DEMO_ASSEMBLY } from "@/lib/demoScene";

function sseEvent(data: object) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(sseEvent(data)));
      };

      try {
        const body = await req.json();
        const { prompt, specs, pdfBase64 } = body;
        const apiKey = process.env.ANTHROPIC_API_KEY;

        const isDemo = !apiKey || !pdfBase64;

        if (isDemo) {
          // Demo mode: simulate pipeline timing
          const steps = [
            "Reading datasheet…",
            "Calculating component values…",
            "Sourcing R1 on Digikey…",
            "Sourcing R2 on Digikey…",
            "Sourcing L1 on Digikey…",
            "Sourcing capacitors on Digikey…",
            "Placing components on board…",
            "Generating assembly instructions…",
            "Done.",
          ];
          for (const message of steps) {
            send({ type: "status", message });
            await new Promise((r) => setTimeout(r, 500));
          }
          send({ type: "result", sceneGraph: DEMO_SCENE, traces: DEMO_TRACES, assemblySteps: DEMO_ASSEMBLY });
        } else {
          const { runPipeline } = await import("@/lib/pipeline");
          await runPipeline({ prompt, specs, pdfBase64, apiKey, send });
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ type: "status", message: `Pipeline error: ${message}` });
        send({ type: "error", message });
      } finally {
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
