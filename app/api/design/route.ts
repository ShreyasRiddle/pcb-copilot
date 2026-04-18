import { NextRequest } from "next/server";
import { DEMO_SCENE, DEMO_TRACES } from "@/lib/demoScene";

function sseEvent(data: object) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  // Streaming SSE response
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(sseEvent(data)));
      };

      try {
        const { prompt, specs, pdfBase64 } = await req.json();

        // Check for API key
        const apiKey = process.env.ANTHROPIC_API_KEY;

        if (!apiKey || pdfBase64 === undefined) {
          // Demo mode: stream fake progress then return demo scene
          const steps = [
            "Reading datasheet…",
            "Extracting topology and design equations…",
            "Calculating feedback resistors…",
            "Solving inductor and capacitor values…",
            "Sourcing R1 on Digikey…",
            "Sourcing R2 on Digikey…",
            "Sourcing L1 on Digikey…",
            "Sourcing capacitors on Digikey…",
            "Placing components on board…",
            "Done.",
          ];

          for (const message of steps) {
            send({ type: "status", message });
            await new Promise((r) => setTimeout(r, 600));
          }

          send({
            type: "result",
            sceneGraph: DEMO_SCENE,
            traces: DEMO_TRACES,
          });

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        // Real AI pipeline — imported lazily to avoid issues when key is absent
        const { runPipeline } = await import("@/lib/pipeline");
        await runPipeline({ prompt, specs, pdfBase64, apiKey, send });

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(
          encoder.encode(sseEvent({ type: "status", message: `Error: ${message}` }))
        );
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
