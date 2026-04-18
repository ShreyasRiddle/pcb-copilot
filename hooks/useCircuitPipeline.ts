"use client";

import { useState, useCallback } from "react";
import { SceneComponent } from "@/lib/types";
import { DEMO_SCENE, DEMO_TRACES } from "@/lib/demoScene";

interface PipelineState {
  loading: boolean;
  status: string;
  components: SceneComponent[];
  traces: [string, string][];
}

export function useCircuitPipeline() {
  const [state, setState] = useState<PipelineState>({
    loading: false,
    status: "",
    components: DEMO_SCENE,
    traces: DEMO_TRACES,
  });

  const run = useCallback(
    async (prompt: string, specs: { vin: string; vout: string; iout: string }, pdfBase64?: string) => {
      setState((s) => ({ ...s, loading: true, status: "Starting pipeline…" }));

      try {
        const res = await fetch("/api/design", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, specs, pdfBase64 }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`API error: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

          for (const line of lines) {
            const raw = line.slice(6).trim();
            if (!raw || raw === "[DONE]") continue;

            try {
              const event = JSON.parse(raw) as
                | { type: "status"; message: string }
                | { type: "result"; sceneGraph: SceneComponent[]; traces: [string, string][] };

              if (event.type === "status") {
                setState((s) => ({ ...s, status: event.message }));
              } else if (event.type === "result") {
                setState((s) => ({
                  ...s,
                  components: event.sceneGraph,
                  traces: event.traces,
                  status: "Done.",
                  loading: false,
                }));
              }
            } catch {
              // non-JSON line, skip
            }
          }
        }
      } catch (err) {
        console.error("Pipeline error:", err);
        setState((s) => ({
          ...s,
          loading: false,
          status: "Pipeline failed — check console.",
        }));
      } finally {
        setState((s) => ({ ...s, loading: false }));
      }
    },
    []
  );

  return { ...state, run };
}
