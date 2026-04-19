"use client";

/** When set, CognitoAuthShell uses Amplify instead of Hosted UI (escape hatch for Managed login issues). */
export const PREFER_AMPLIFY_SESSION_KEY = "pcb_prefer_amplify_auth";

export function readPreferAmplifyBypass(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(PREFER_AMPLIFY_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function notifyBypassChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pcb-prefer-amplify-changed"));
  }
}

export function setPreferAmplifyBypass(): void {
  try {
    sessionStorage.setItem(PREFER_AMPLIFY_SESSION_KEY, "1");
  } catch {
    return;
  }
  notifyBypassChanged();
}

export function clearPreferAmplifyBypass(): void {
  try {
    sessionStorage.removeItem(PREFER_AMPLIFY_SESSION_KEY);
  } catch {
    return;
  }
  notifyBypassChanged();
}
