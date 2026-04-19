"use client";

import { Amplify } from "aws-amplify";

let configured = false;

/** Call once on the client before any Auth API. Safe to call multiple times. */
export function configureAmplify(): boolean {
  if (typeof window === "undefined") return false;
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  if (!userPoolId || !userPoolClientId) return false;
  if (configured) return true;

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
      },
    },
  });
  configured = true;
  return true;
}

/** True when Cognito env is present. Intentionally does not check `window` so SSR and the first client paint match (avoids AuthControls hydration mismatch). */
export function isAmplifyConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID &&
      process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID
  );
}
