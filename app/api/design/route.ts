import { NextRequest } from "next/server";
import { DEMO_WIRING } from "@/lib/demoWiring";

function sseEvent(data: object): string {
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
        const { prompt, specs, pdfBase64 } = await req.json();
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
          // Demo mode: no API key configured — stream fake progress then return hardcoded demo
          const steps: Array<{ step: 1 | 2 | 3 | 4; message: string }> = [
            { step: 1, message: "Reading datasheet…" },
            { step: 1, message: "Extracting topology and design equations…" },
            { step: 2, message: "Calculating feedback resistors…" },
            { step: 2, message: "Solving inductor and capacitor values…" },
            { step: 3, message: "Sourcing R1 on Digikey…" },
            { step: 3, message: "Sourcing L1 on Digikey…" },
            { step: 3, message: "Sourcing Cin, Cout, Cboot on Digikey…" },
            { step: 4, message: "Building wiring diagram…" },
          ];

          for (const s of steps) {
            send({ type: "status", step: s.step, message: s.message });
            await new Promise((r) => setTimeout(r, 500));
          }

          send({ type: "result", data: DEMO_WIRING });
        } else {
          // Real pipeline — runs whenever there is an API key.
          // pdfBase64 may be undefined (text-only prompt path).
          const { runPipeline } = await import("@/lib/pipeline");
          await runPipeline({ prompt, specs, pdfBase64, apiKey, send });
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown pipeline error";
        const send = (data: object) => {
          controller.enqueue(encoder.encode(sseEvent(data)));
        };
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
