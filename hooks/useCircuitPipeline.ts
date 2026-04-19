"use client";

import { useState, useCallback } from "react";
import { SceneComponent, AssemblyStep } from "@/lib/types";
import { DEMO_SCENE, DEMO_TRACES, DEMO_ASSEMBLY } from "@/lib/demoScene";

interface PipelineState {
  loading: boolean;
  status: string;
  components: SceneComponent[];
  traces: [string, string][];
  assemblySteps: AssemblyStep[];
  error: string | null;
}

export function useCircuitPipeline() {
  const [state, setState] = useState<PipelineState>({
    loading: false,
    status: "",
    components: DEMO_SCENE,
    traces: DEMO_TRACES,
    assemblySteps: DEMO_ASSEMBLY,
    error: null,
  });

  const run = useCallback(
    async (
      prompt: string,
      specs: { vin: string; vout: string; iout: string },
      pdfBase64?: string
    ) => {
      setState((s) => ({ ...s, loading: true, status: "Starting…", error: null }));

      try {
        const res = await fetch("/api/design", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, specs, pdfBase64 }),
        });

        if (!res.ok || !res.body) throw new Error(`API error: ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const lines = decoder.decode(value).split("\n").filter((l) => l.startsWith("data: "));

          for (const line of lines) {
            const raw = line.slice(6).trim();
            if (!raw || raw === "[DONE]") continue;

            try {
              const event = JSON.parse(raw);

              if (event.type === "status") {
                setState((s) => ({ ...s, status: event.message }));
              } else if (event.type === "result") {
                setState((s) => ({
                  ...s,
                  components: event.sceneGraph ?? s.components,
                  traces: event.traces ?? s.traces,
                  assemblySteps: event.assemblySteps ?? s.assemblySteps,
                  loading: false,
                }));
              } else if (event.type === "error") {
                setState((s) => ({ ...s, error: event.message, loading: false }));
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setState((s) => ({ ...s, error: message, loading: false, status: "Pipeline failed." }));
      } finally {
        setState((s) => ({ ...s, loading: false }));
      }
    },
    []
  );

  return { ...state, run };
}
