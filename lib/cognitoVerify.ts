/**
 * Verify Cognito ID tokens from Authorization: Bearer <jwt>
 */

import { CognitoJwtVerifier } from "aws-jwt-verify";

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? process.env.COGNITO_USER_POOL_ID;
const clientId =
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? process.env.COGNITO_CLIENT_ID;

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (!userPoolId || !clientId) return null;
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId,
      clientId,
      tokenUse: "id",
    });
  }
  return verifier;
}

export function isCognitoConfigured(): boolean {
  return Boolean(userPoolId && clientId);
}

/**
 * Returns Cognito `sub` for the user, or null if missing/invalid token.
 */
export async function verifyBearerGetSub(
  authHeader: string | null
): Promise<string | null> {
  const v = getVerifier();
  if (!v || !authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const payload = await v.verify(token);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
