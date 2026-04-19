"use client";

import { useSyncExternalStore } from "react";
import {
  PREFER_AMPLIFY_SESSION_KEY,
  readPreferAmplifyBypass,
} from "@/lib/cognitoAuthBypass";

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const fn = () => onStoreChange();
  window.addEventListener("pcb-prefer-amplify-changed", fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === PREFER_AMPLIFY_SESSION_KEY || e.key === null) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("pcb-prefer-amplify-changed", fn);
    window.removeEventListener("storage", onStorage);
  };
}

/** True when user chose in-browser Amplify sign-in instead of Cognito Hosted UI (sessionStorage). */
export function usePreferAmplifyBypass(): boolean {
  // Force fallback auth path globally: always use Amplify/email-password flow,
  // never Hosted UI. Keeps behavior stable across environments.
  return true;
}
