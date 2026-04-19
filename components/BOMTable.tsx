"use client";

import { motion, AnimatePresence } from "framer-motion";
import { SceneComponent } from "@/lib/types";

interface BOMTableProps {
  components: SceneComponent[];
  isOpen: boolean;
  onClose: () => void;
  onSelect: (c: SceneComponent) => void;
}

function exportCSV(components: SceneComponent[]) {
  const headers = ["Ref", "Type", "Value", "Package", "Part Number", "Price", "In Stock", "Distributor", "URL"];
  const rows = components.map((c) => [
    c.id, c.type.replace("_", " "), c.value, c.package ?? "",
    c.partNumber ?? "", c.price ?? "", c.inStock ? "Yes" : "No",
    c.distributor ?? "", c.url ?? "",
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bom.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function BOMTable({ components, isOpen, onClose, onSelect }: BOMTableProps) {
  const totalCost = components
    .reduce((sum, c) => sum + parseFloat(c.price?.replace("$", "") ?? "0"), 0)
    .toFixed(2);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
          className="glass fixed inset-x-4 bottom-4 z-40 max-h-[55vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-white">Bill of Materials</span>
              <span className="text-xs text-zinc-500">{components.length} components · ${totalCost} total</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportCSV(components)}
                className="text-xs px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition-colors"
              >
                Export CSV
              </button>
              <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg leading-none transition-colors">×</button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0f0f1a]/90">
                <tr className="text-zinc-500 uppercase tracking-widest text-[10px]">
                  {["Ref", "Type", "Value", "Package", "Part Number", "Price", "Stock", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-2 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {components.map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => onSelect(c)}
                    className="border-t border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-cyan-400">{c.id}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{c.type.replace("_", " ")}</td>
                    <td className="px-4 py-2.5 text-white font-medium">{c.value}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{c.package ?? "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-zinc-300">{c.partNumber ?? "—"}</td>
                    <td className="px-4 py-2.5 text-emerald-400">{c.price ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {c.inStock === undefined ? (
                        <span className="text-zinc-600">—</span>
                      ) : c.inStock ? (
                        <span className="text-emerald-400">✓</span>
                      ) : (
                        <span className="text-amber-400">Backorder</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-cyan-500 hover:text-cyan-300 transition-colors"
                        >
                          Buy →
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
