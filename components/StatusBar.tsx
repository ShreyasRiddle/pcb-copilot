"use client";

import { motion, AnimatePresence } from "framer-motion";

interface StatusBarProps {
  status: string;
  loading: boolean;
}

export default function StatusBar({ status, loading }: StatusBarProps) {
  return (
    <AnimatePresence>
      {(loading || status) && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="glass fixed bottom-4 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 flex items-center gap-3 min-w-60"
        >
          {loading && (
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse shrink-0" />
          )}
          {!loading && (
            <div className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" />
          )}
          <span className="text-sm text-zinc-200">{status}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
