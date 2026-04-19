"use client";

import { decodeJwtPayload } from "./jwtDecode";

const STORAGE_KEY = "pcb_copilot.cognitoProxy.v1";

export type CognitoProxySession = {
  v: 1;
  username: string;
  idToken: string;
  accessToken: string;
  refreshToken: string;
  /** Epoch ms (from JWT `exp`) */
  expiresAt: number;
};

function idTokenExpiryMs(idToken: string): number {
  const p = decodeJwtPayload(idToken);
  const exp = typeof p?.exp === "number" ? p.exp : 0;
  return exp > 0 ? exp * 1000 : Date.now() + 3600_000;
}

export function readProxySession(): CognitoProxySession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as CognitoProxySession;
    if (o?.v !== 1 || !o.idToken || !o.refreshToken || !o.username) return null;
    return o;
  } catch {
    return null;
  }
}

export function writeProxySessionFromTokens(username: string, tokens: {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}): void {
  const session: CognitoProxySession = {
    v: 1,
    username,
    idToken: tokens.idToken,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: idTokenExpiryMs(tokens.idToken),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function updateProxySessionTokens(tokens: {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}): void {
  const prev = readProxySession();
  if (!prev) return;
  writeProxySessionFromTokens(prev.username, {
    idToken: tokens.idToken,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? prev.refreshToken,
  });
}

export function clearProxySession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function emailFromProxyIdToken(idToken: string): string | null {
  const p = decodeJwtPayload(idToken);
  if (typeof p?.email === "string" && p.email) return p.email;
  const u = p?.["cognito:username"];
  if (typeof u === "string" && u) return u;
  return null;
}

export function proxySessionNeedsRefresh(session: CognitoProxySession, skewMs = 120_000): boolean {
  return Date.now() >= session.expiresAt - skewMs;
}
