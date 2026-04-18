"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ComponentNode } from "@/lib/types";

interface SourcingPanelProps {
  node: ComponentNode | null;
  onClose: () => void;
}

export default function SourcingPanel({ node, onClose }: SourcingPanelProps) {
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key={node.id}
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
                {node.id}
              </div>
              <div className="text-xl font-semibold text-white">
                {node.label.replace(/\n/g, " ")}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-colors mt-0.5 text-lg leading-none"
            >
              ×
            </button>
          </div>

          {/* Sourcing */}
          <div className="px-5 py-4 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">
              Sourcing
            </div>

            {node.bom ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400">Part Number</span>
                  <span className="text-xs font-mono text-white">{node.bom.partNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400">Distributor</span>
                  <span className="text-xs text-white">{node.bom.distributor ?? "Digikey"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400">Unit Price</span>
                  <span className="text-xs text-emerald-400 font-medium">{node.bom.price}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400">Stock</span>
                  {node.bom.backordered ? (
                    <span className="text-xs font-medium text-amber-400 flex items-center gap-1">
                      <span
                        style={{
                          display: "inline-block",
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#f59e0b",
                        }}
                      />
                      Backordered
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-emerald-400">In Stock</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 italic">
                No sourcing data — run the pipeline with a datasheet to populate.
              </p>
            )}
          </div>

          {/* Buy button */}
          {node.bom?.url && (
            <div className="p-5 border-t border-white/10">
              <a
                href={node.bom.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-500/40 text-cyan-300 text-sm font-medium transition-colors"
              >
                Buy on {node.bom?.distributor ?? "Digikey"} →
              </a>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
