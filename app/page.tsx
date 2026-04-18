"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { SceneComponent } from "@/lib/types";
import { useCircuitPipeline } from "@/hooks/useCircuitPipeline";
import SourcingPanel from "@/components/SourcingPanel";
import StatusBar from "@/components/StatusBar";
import InputDrawer from "@/components/InputDrawer";

// Load 3D canvas client-side only (no SSR)
const CircuitBoard3D = dynamic(() => import("@/components/CircuitBoard3D"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "absolute", inset: 0, background: "#0a0a0f" }} className="flex items-center justify-center">
      <div className="text-zinc-600 text-sm animate-pulse">Initializing 3D scene…</div>
    </div>
  ),
});

export default function Home() {
  const [selected, setSelected] = useState<SceneComponent | null>(null);
  const { loading, status, components, traces, run } = useCircuitPipeline();

  return (
    <main style={{ background: "#0a0a0f" }} className="w-screen h-screen overflow-hidden relative">
      {/* Full-screen 3D canvas — hero layer */}
      <CircuitBoard3D
        components={components}
        traces={traces}
        onSelect={setSelected}
        selected={selected}
      />

      {/* Input drawer (left) */}
      <InputDrawer onRun={run} loading={loading} />

      {/* Sourcing panel (right, slides in on click) */}
      <SourcingPanel component={selected} onClose={() => setSelected(null)} />

      {/* Status bar (bottom center) */}
      <StatusBar status={status} loading={loading} />

      {/* Top-right hint */}
      {!selected && (
        <div className="fixed top-4 right-4 z-20 text-[11px] text-zinc-600 pointer-events-none">
          click any component
        </div>
      )}
    </main>
  );
}
