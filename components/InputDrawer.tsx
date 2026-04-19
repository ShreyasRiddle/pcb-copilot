"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Specs {
  vin: string;
  vout: string;
  iout: string;
}

interface InputDrawerProps {
  onRun: (prompt: string, specs: Specs, pdfBase64?: string) => void;
  loading: boolean;
}

export default function InputDrawer({ onRun, loading }: InputDrawerProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("Buck converter using TPS563201, 12V in, 5V out, 2A");
  const [specs, setSpecs] = useState<Specs>({ vin: "12", vout: "5", iout: "2" });
  const [pdfBase64, setPdfBase64] = useState<string | undefined>();
  const [fileName, setFileName] = useState<string>("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix
      const base64 = result.split(",")[1];
      setPdfBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = () => {
    const vin = parseFloat(specs.vin);
    const vout = parseFloat(specs.vout);
    const iout = parseFloat(specs.iout);

    if (isNaN(vin) || isNaN(vout) || isNaN(iout)) {
      setValidationError("All specs must be numbers.");
      return;
    }
    if (vout >= vin) {
      setValidationError("Vout must be less than Vin.");
      return;
    }
    if (iout <= 0) {
      setValidationError("Iout must be greater than 0.");
      return;
    }
    if (vin <= 0) {
      setValidationError("Vin must be greater than 0.");
      return;
    }
    setValidationError(null);
    onRun(prompt, specs, pdfBase64);
    setOpen(false);
  };

  return (
    <>
      {/* Toggle button */}
      <motion.button
        onClick={() => setOpen((o) => !o)}
        className="glass fixed left-4 top-4 z-30 px-4 py-2.5 text-sm font-medium text-white flex items-center gap-2 hover:bg-white/10 transition-colors"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span className="text-cyan-400">⬡</span>
        PCB Copilot
        <span className="text-zinc-500 text-xs ml-1">{open ? "×" : "↗"}</span>
      </motion.button>

      {/* Drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: -360, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -360, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="glass fixed left-4 top-16 z-30 w-72 flex flex-col overflow-hidden"
          >
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">
                  Circuit Description
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(["vin", "vout", "iout"] as const).map((key) => (
                  <div key={key}>
                    <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1">
                      {key === "vin" ? "Vin (V)" : key === "vout" ? "Vout (V)" : "Iout (A)"}
                    </label>
                    <input
                      type="number"
                      value={specs[key]}
                      onChange={(e) => setSpecs((s) => ({ ...s, [key]: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">
                  IC Datasheet (PDF)
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-white/5 border border-white/10 border-dashed rounded-lg px-3 py-2.5 hover:bg-white/8 transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFile}
                    className="hidden"
                  />
                  <span className="text-zinc-400 text-xs">
                    {fileName || "Upload datasheet PDF…"}
                  </span>
                </label>
              </div>

              {validationError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {validationError}
                </p>
              )}

              {!pdfBase64 && (
                <p className="text-[10px] text-zinc-600">
                  No PDF uploaded — will run in demo mode.
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-500/40 text-cyan-300 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Running pipeline…" : "Generate PCB →"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
