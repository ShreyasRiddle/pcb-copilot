/** Read Cognito `sub` from an ID token without verifying the signature (display / client routing only). */
export function decodeJwtSub(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    let b = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = (4 - (b.length % 4)) % 4;
    b += "=".repeat(pad);
    const payload = JSON.parse(atob(b)) as { sub?: string };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
