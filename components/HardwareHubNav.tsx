"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import AuthControls from "@/components/AuthControls";

const navStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  height: 52,
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 24px",
  background: "rgba(13, 13, 18, 0.8)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  borderBottom: "1px solid var(--border)",
};

export default function HardwareHubNav() {
  return (
    <nav style={navStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <svg width={22} height={22} viewBox="0 0 28 28" fill="none">
            <rect width={28} height={28} rx={7} fill="rgba(110,231,247,0.15)" />
            <path
              d="M7 14h4M17 14h4M14 7v4M14 17v4"
              stroke="#6ee7f7"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <circle cx={14} cy={14} r={3} fill="#6ee7f7" fillOpacity={0.35} stroke="#6ee7f7" strokeWidth={1.5} />
          </svg>
          <span
            style={{
              fontFamily: "var(--font-space), system-ui, sans-serif",
              fontWeight: 600,
              fontSize: 15,
              letterSpacing: "-0.02em",
              color: "var(--text-1)",
            }}
          >
            PCB Copilot
          </span>
        </Link>
        <Link
          href="/hardware"
          className="btn-ghost"
          style={{ padding: "5px 12px", textDecoration: "none", fontSize: 12 }}
        >
          Hardware hub
        </Link>
        <Link
          href="/hardware/new"
          className="btn-ghost"
          style={{ padding: "5px 12px", textDecoration: "none", fontSize: 12 }}
        >
          New project
        </Link>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <AuthControls />
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="btn-ghost"
          style={{ padding: "5px 12px", textDecoration: "none", fontSize: 12 }}
        >
          GitHub ↗
        </a>
      </div>
    </nav>
  );
}
