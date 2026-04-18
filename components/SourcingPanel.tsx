"use client";

import { motion, AnimatePresence } from "framer-motion";
import { SceneComponent } from "@/lib/types";

interface SourcingPanelProps {
  component: SceneComponent | null;
  onClose: () => void;
}

export default function SourcingPanel({ component, onClose }: SourcingPanelProps) {
  return (
    <AnimatePresence>
      {component && (
        <motion.div
          key={component.id}
          initial={{ x: 340, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 340, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="glass fixed right-4 top-4 bottom-4 w-72 z-30 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-white/10">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-cyan-400 mb-1">
                {component.id} · {component.type.replace("_", " ")}
              </div>
              <div className="text-xl font-semibold text-white">{component.value}</div>
              {component.package && (
                <div className="text-xs text-zinc-400 mt-0.5">{component.package}</div>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-colors mt-0.5 text-lg leading-none"
            >
              ×
            </button>
          </div>

          {/* Reasoning */}
          {component.reasoning && (
            <div className="px-5 py-3 border-b border-white/10">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Design Rationale</div>
              <p className="text-sm text-zinc-300 leading-relaxed">{component.reasoning}</p>
            </div>
          )}

          {/* Sourcing */}
          <div className="px-5 py-4 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Sourcing</div>

            {component.partNumber ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400">Part Number</span>
                  <span className="text-xs font-mono text-white">{component.partNumber}</span>
                </div>
                {component.distributor && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-400">Distributor</span>
                    <span className="text-xs text-white">{component.distributor}</span>
                  </div>
                )}
                {component.price && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-400">Unit Price</span>
                    <span className="text-xs text-emerald-400 font-medium">{component.price}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400">Stock</span>
                  <span
                    className={`text-xs font-medium ${
                      component.inStock ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {component.inStock ? "In Stock" : "Backordered"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 italic">No sourcing data yet — run the pipeline to populate.</p>
            )}
          </div>

          {/* Buy button */}
          {component.url && (
            <div className="p-5 border-t border-white/10">
              <a
                href={component.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-500/40 text-cyan-300 text-sm font-medium transition-colors"
              >
                Buy on {component.distributor || "Digikey"} →
              </a>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
