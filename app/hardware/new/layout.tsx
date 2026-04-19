import { Suspense, type ReactNode } from "react";

export default function NewHardwareLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div style={{ padding: 80, textAlign: "center", color: "var(--text-3)" }}>Loading…</div>}>{children}</Suspense>;
}
