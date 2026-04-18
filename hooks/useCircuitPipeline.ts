"use client";

import { useState, useCallback, useRef } from "react";
import { WiringGraph, SSEEvent, ClarificationQuestion } from "@/lib/types";
import { DEMO_WIRING } from "@/lib/demoWiring";

interface PipelineState {
  loading: boolean;
  step: 1 | 2 | 3 | 4 | null;
  status: string;
  wiringGraph: WiringGraph;
  /** True once data is available (including demo) */
  hasResult: boolean;
  /** True when showing the hardcoded demo circuit */
  isDemo: boolean;
  /** Non-null when the AI needs more information before proceeding */
  clarificationQuestions: ClarificationQuestion[] | null;
}

export function useCircuitPipeline() {
  const [state, setState] = useState<PipelineState>({
    loading: false,
    step: null,
    status: "",
    wiringGraph: DEMO_WIRING,
    hasResult: true,
    isDemo: true,
    clarificationQuestions: null,
  });

  // Keep the last prompt so runWithAnswers can append to it
  const lastPromptRef = useRef<string>("");
  const lastPdfRef = useRef<string | undefined>(undefined);

  const run = useCallback(
    async (
      prompt: string,
      specs: { vin: string; vout: string; iout: string },
      pdfBase64?: string
    ) => {
      lastPromptRef.current = prompt;
      lastPdfRef.current = pdfBase64;

      setState((s) => ({
        ...s,
        loading: true,
        step: null,
        status: "Starting pipeline…",
        clarificationQuestions: null,
      }));

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

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

          for (const line of lines) {
            const raw = line.slice(6).trim();
            if (!raw || raw === "[DONE]") continue;

            try {
              const event = JSON.parse(raw) as SSEEvent;

              if (event.type === "status") {
                setState((s) => ({
                  ...s,
                  step: event.step,
                  status: event.message,
                }));
              } else if (event.type === "result") {
                setState((s) => ({
                  ...s,
                  wiringGraph: event.data,
                  hasResult: true,
                  isDemo: false,
                  step: null,
                  status: "Done.",
                  loading: false,
                  clarificationQuestions: null,
                }));
              } else if (event.type === "error") {
                setState((s) => ({
                  ...s,
                  loading: false,
                  step: null,
                  status: `Error: ${event.message}`,
                }));
              } else if (event.type === "question") {
                setState((s) => ({
                  ...s,
                  loading: false,
                  step: null,
                  status: "",
                  clarificationQuestions: event.questions,
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
          step: null,
          status: "Pipeline failed — check console.",
        }));
      } finally {
        setState((s) => ({ ...s, loading: false }));
      }
    },
    []
  );

  /**
   * Called by ClarificationCard when the user answers the questions.
   * Appends answers to the original prompt and re-runs the pipeline.
   */
  const runWithAnswers = useCallback(
    (answers: Record<string, string>) => {
      const answerLines = Object.entries(answers)
        .filter(([, v]) => v.trim())
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");

      const enrichedPrompt = lastPromptRef.current
        ? `${lastPromptRef.current}. Additional details: ${answerLines}`
        : answerLines;

      run(enrichedPrompt, { vin: "", vout: "", iout: "" }, lastPdfRef.current);
    },
    [run]
  );

  return { ...state, run, runWithAnswers };
}
