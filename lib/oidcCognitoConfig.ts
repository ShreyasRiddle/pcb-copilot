import type { UserManagerSettings } from "oidc-client-ts";

/** Use Cognito Hosted UI + react-oidc-context (authorization code + PKCE). */
export function cognitoHostedUiEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_COGNITO_USE_HOSTED_UI === "1" ||
    process.env.NEXT_PUBLIC_COGNITO_USE_HOSTED_UI === "true"
  );
}

function authorityFromPoolId(): string | null {
  const pool = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID?.trim();
  if (!pool) return null;
  const i = pool.indexOf("_");
  if (i <= 0) return null;
  const region = pool.slice(0, i);
  return `https://cognito-idp.${region}.amazonaws.com/${pool}`;
}

/**
 * OIDC settings for AuthProvider. Returns null if Hosted UI is enabled but env is incomplete.
 */
export function getCognitoOidcUserManagerSettings(): UserManagerSettings | null {
  if (!cognitoHostedUiEnabled()) return null;

  const authority =
    process.env.NEXT_PUBLIC_COGNITO_OIDC_AUTHORITY?.trim() || authorityFromPoolId();
  const client_id = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID?.trim();
  const redirect_uri = process.env.NEXT_PUBLIC_COGNITO_OIDC_REDIRECT_URI?.trim();
  const post_logout_redirect_uri =
    process.env.NEXT_PUBLIC_COGNITO_OIDC_POST_LOGOUT_REDIRECT_URI?.trim() ||
    "http://localhost:3000/";

  if (!authority || !client_id || !redirect_uri) return null;

  // Default `openid` only — add `email` / `profile` via NEXT_PUBLIC_COGNITO_OIDC_SCOPE only after
  // enabling those scopes on the app client (Hosted UI → OpenID Connect scopes), or Cognito
  // returns invalid_scope.
  const scope =
    process.env.NEXT_PUBLIC_COGNITO_OIDC_SCOPE?.trim().replace(/\s+/g, " ") ?? "openid";

  return {
    authority,
    client_id,
    redirect_uri,
    post_logout_redirect_uri,
    response_type: "code",
    scope,
    // Cognito + silent renew often needs extra refresh-token setup; avoid invalid_scope noise.
    automaticSilentRenew:
      process.env.NEXT_PUBLIC_COGNITO_OIDC_SILENT_RENEW === "1" ||
      process.env.NEXT_PUBLIC_COGNITO_OIDC_SILENT_RENEW === "true",
  };
}

/** Full Hosted UI + OIDC wiring is present (AuthProvider can mount). */
export function cognitoHostedUiReady(): boolean {
  return cognitoHostedUiEnabled() && getCognitoOidcUserManagerSettings() !== null;
}

/** Cognito logout endpoint (clears Hosted UI session). */
export function buildCognitoHostedLogoutUrl(): string | null {
  const domain = process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN?.trim().replace(/\/$/, "");
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID?.trim();
  const logoutUri =
    process.env.NEXT_PUBLIC_COGNITO_OIDC_POST_LOGOUT_REDIRECT_URI?.trim() ||
    "http://localhost:3000/";
  if (!domain || !clientId) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    logout_uri: logoutUri,
  });
  return `${domain}/logout?${params.toString()}`;
}
