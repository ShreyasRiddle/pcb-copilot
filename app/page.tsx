"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { SceneComponent } from "@/lib/types";
import { useCircuitPipeline } from "@/hooks/useCircuitPipeline";
import SourcingPanel from "@/components/SourcingPanel";
import StatusBar from "@/components/StatusBar";
import InputDrawer from "@/components/InputDrawer";
import BOMTable from "@/components/BOMTable";
import AssemblyPanel from "@/components/AssemblyPanel";

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
  const [showBOM, setShowBOM] = useState(false);
  const [showAssembly, setShowAssembly] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const { loading, status, error, components, traces, assemblySteps, run } = useCircuitPipeline();

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "b" || e.key === "B") setShowBOM((v) => !v);
      if (e.key === "a" || e.key === "A") setShowAssembly((v) => !v);
      if (e.key === "Escape") {
        setSelected(null);
        setShowBOM(false);
        setShowAssembly(false);
        setHighlightedId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSelect = (c: SceneComponent | null) => {
    setSelected(c);
    setHighlightedId(null);
    setShowAssembly(false);
  };

  const handleHighlight = (componentId: string) => {
    setHighlightedId((prev) => (prev === componentId ? null : componentId));
    setSelected(null);
  };

  return (
    <main style={{ background: "#0a0a0f" }} className="w-screen h-screen overflow-hidden relative">
      {/* Hero: full-screen 3D canvas */}
      <CircuitBoard3D
        components={components}
        traces={traces}
        onSelect={handleSelect}
        selected={selected}
        highlightedId={highlightedId}
      />

      {/* Input drawer — left */}
      <InputDrawer onRun={run} loading={loading} />

      {/* Sourcing panel — right, on component click */}
      <SourcingPanel component={selected} onClose={() => setSelected(null)} />

      {/* Assembly panel — right, on assembly toggle (hides sourcing) */}
      {!selected && (
        <AssemblyPanel
          steps={assemblySteps}
          isOpen={showAssembly}
          onClose={() => setShowAssembly(false)}
          onHighlight={handleHighlight}
          highlightedId={highlightedId}
        />
      )}

      {/* BOM table — bottom overlay */}
      <BOMTable
        components={components}
        isOpen={showBOM}
        onClose={() => setShowBOM(false)}
        onSelect={(c) => { setSelected(c); setShowBOM(false); }}
      />

      {/* Status bar */}
      <StatusBar status={error ? `Error: ${error}` : status} loading={loading} />

      {/* Toolbar — top right */}
      <div className="fixed top-4 right-4 z-20 flex items-center gap-2">
        {!selected && !showAssembly && (
          <span className="text-[11px] text-zinc-600 pointer-events-none mr-2">click any component</span>
        )}
        <button
          onClick={() => { setShowAssembly((v) => !v); setSelected(null); }}
          className={`glass-light text-[11px] px-3 py-1.5 rounded-lg transition-colors ${showAssembly ? "text-cyan-400 border-cyan-500/30" : "text-zinc-400 hover:text-white"}`}
          title="Assembly steps (A)"
        >
          ⚙ Build
        </button>
        <button
          onClick={() => setShowBOM((v) => !v)}
          className={`glass-light text-[11px] px-3 py-1.5 rounded-lg transition-colors ${showBOM ? "text-cyan-400 border-cyan-500/30" : "text-zinc-400 hover:text-white"}`}
          title="Bill of Materials (B)"
        >
          ≡ BOM
        </button>
      </div>
    </main>
  );
}
