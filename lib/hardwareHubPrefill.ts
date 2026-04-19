/** sessionStorage key for `/hardware/new?prefill=1` (set from PCB Copilot home). */
export const HARDWARE_NEW_PREFILL_SESSION_KEY = "pcb_hardware_new_prefill";

export interface HardwareNewPrefillPayload {
  title: string;
  description: string;
  readmeMarkdown: string;
}

export function buildHardwareHubPrefill(prompt: string): HardwareNewPrefillPayload {
  const raw = prompt.trim();
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const first = (lines[0] ?? "Copilot design").trim();
  const title = first.length > 100 ? `${first.slice(0, 97)}…` : first || "Copilot design";
  const description =
    raw.length > 280 ? `${raw.slice(0, 277)}…` : raw || "Generated in PCB Copilot.";
  const readmeMarkdown = `## Circuit request (PCB Copilot)\n\n${raw || "(no prompt text)"}\n`;
  return { title, description, readmeMarkdown };
}

export function stashHardwareHubPrefill(payload: HardwareNewPrefillPayload): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(HARDWARE_NEW_PREFILL_SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function consumeHardwareHubPrefill(): HardwareNewPrefillPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(HARDWARE_NEW_PREFILL_SESSION_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(HARDWARE_NEW_PREFILL_SESSION_KEY);
    const data = JSON.parse(raw) as HardwareNewPrefillPayload;
    if (typeof data.title !== "string" || typeof data.description !== "string") return null;
    return {
      title: data.title,
      description: data.description,
      readmeMarkdown: typeof data.readmeMarkdown === "string" ? data.readmeMarkdown : "",
    };
  } catch {
    return null;
  }
}
