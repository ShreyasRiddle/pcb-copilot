"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AssemblyStep } from "@/lib/types";

interface AssemblyPanelProps {
  steps: AssemblyStep[];
  isOpen: boolean;
  onClose: () => void;
  onHighlight: (componentId: string) => void;
  highlightedId: string | null;
}

export default function AssemblyPanel({
  steps, isOpen, onClose, onHighlight, highlightedId,
}: AssemblyPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
          className="glass fixed right-4 top-4 bottom-4 w-80 z-30 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-0.5">Build Guide</div>
              <div className="text-sm font-semibold text-white">Assembly Instructions</div>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg leading-none transition-colors">×</button>
          </div>

          {/* Steps */}
          <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
            {steps.length === 0 && (
              <p className="text-sm text-zinc-600 italic px-1 pt-2">Run the pipeline to generate assembly instructions.</p>
            )}
            {steps.map((step) => {
              const isActive = highlightedId === step.componentId;
              return (
                <motion.button
                  key={step.stepNumber}
                  onClick={() => onHighlight(step.componentId)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    isActive
                      ? "bg-cyan-500/15 border-cyan-500/40"
                      : "bg-white/3 border-white/8 hover:bg-white/8"
                  }`}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                        isActive ? "bg-cyan-500 text-black" : "bg-white/10 text-zinc-400"
                      }`}
                    >
                      {step.stepNumber}
                    </span>
                    <div>
                      <div className={`text-[10px] uppercase tracking-widest mb-1 ${isActive ? "text-cyan-400" : "text-zinc-600"}`}>
                        {step.componentId}
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">{step.instruction}</p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
