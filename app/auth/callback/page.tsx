"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "react-oidc-context";
import {
  cognitoHostedUiEnabled,
  cognitoHostedUiReady,
} from "@/lib/oidcCognitoConfig";

function decodeOAuthParam(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}

function OidcCallbackInner() {
  const auth = useAuth();
  const router = useRouter();
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const raw = p.get("error_description") || p.get("error");
    if (raw) {
      setUrlError(decodeOAuthParam(raw));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (auth.isAuthenticated) {
      router.replace("/");
    }
  }, [auth.isAuthenticated, router]);

  if (urlError) {
    const scopeHint =
      urlError.toLowerCase().includes("scope") || urlError.toLowerCase().includes("invalid_scope");
    const loginPagesHint =
      urlError.toLowerCase().includes("login") ||
      urlError.toLowerCase().includes("administrator");
    return (
      <main
        style={{
          padding: 48,
          color: "#f87171",
          fontFamily: "system-ui",
          maxWidth: 600,
          lineHeight: 1.55,
        }}
      >
        <p style={{ marginBottom: 12, fontWeight: 600 }}>Cognito returned an error</p>
        <p style={{ marginBottom: 16, fontSize: 14 }}>{urlError}</p>
        {scopeHint ? (
          <p style={{ color: "var(--text-2, #aaa)", fontSize: 14, marginBottom: 12 }}>
            For <strong>invalid_scope</strong>: in AWS → Cognito → your user pool → App integration →
            this app client → <strong>Hosted UI</strong> → OpenID Connect scopes, enable every scope
            you request. This app defaults to <code>openid</code> only; add{" "}
            <code>NEXT_PUBLIC_COGNITO_OIDC_SCOPE=openid email</code> in <code>.env.local</code> only
            after enabling <strong>email</strong> for that client.
          </p>
        ) : null}
        {loginPagesHint ? (
          <p style={{ color: "var(--text-2, #aaa)", fontSize: 14, marginBottom: 12 }}>
            <strong>Login pages unavailable</strong> usually means the <strong>Managed login</strong>{" "}
            style is not attached to this app client. Use the <strong>default</strong> app client
            created with the user pool (copy its Client ID into{" "}
            <code>NEXT_PUBLIC_COGNITO_CLIENT_ID</code>), or switch the pool to <strong>Classic</strong>{" "}
            hosted UI in App integration.
          </p>
        ) : null}
        <a href="/" style={{ color: "#7dd3fc" }}>
          Return home
        </a>
      </main>
    );
  }

  if (auth.error) {
    const msg = auth.error.message ?? "Sign-in failed";
    const scopeHint =
      msg.includes("invalid_scope") || msg.toLowerCase().includes("scope");
    const stateHint = msg.includes("state") || msg.includes("storage");
    return (
      <main
        style={{
          padding: 48,
          color: "#f87171",
          fontFamily: "system-ui",
          maxWidth: 560,
          lineHeight: 1.5,
        }}
      >
        <p style={{ marginBottom: 12 }}>Sign-in error: {msg}</p>
        {scopeHint ? (
          <p style={{ color: "var(--text-2, #aaa)", fontSize: 14, marginBottom: 12 }}>
            Cognito rejected the requested OAuth scopes. Enable matching scopes on the app client
            Hosted UI tab, or set <code>NEXT_PUBLIC_COGNITO_OIDC_SCOPE</code> (default in code is{" "}
            <code>openid</code>).
          </p>
        ) : null}
        {stateHint ? (
          <p style={{ color: "var(--text-2, #aaa)", fontSize: 14, marginBottom: 12 }}>
            Start again from the app: click <strong>Sign in with Cognito</strong> (do not bookmark
            this callback URL).
          </p>
        ) : null}
        <a href="/" style={{ color: "#7dd3fc" }}>
          Return home
        </a>
      </main>
    );
  }

  return (
    <main style={{ padding: 48, color: "var(--text-2, #888)", fontFamily: "system-ui" }}>
      Completing sign-in…
    </main>
  );
}

function RedirectHome() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return (
    <main style={{ padding: 48, color: "var(--text-2, #888)", fontFamily: "system-ui" }}>
      Redirecting…
    </main>
  );
}

export default function CognitoOidcCallbackPage() {
  if (cognitoHostedUiEnabled() && !cognitoHostedUiReady()) {
    return (
      <main style={{ padding: 48, color: "#f87171", fontFamily: "system-ui", maxWidth: 520 }}>
        Hosted UI is enabled but OIDC settings are incomplete. Set NEXT_PUBLIC_COGNITO_OIDC_REDIRECT_URI
        (must be this URL), pool ID or NEXT_PUBLIC_COGNITO_OIDC_AUTHORITY, client ID, and Hosted UI domain
        for logout. See .env.example.
      </main>
    );
  }
  if (!cognitoHostedUiReady()) {
    return <RedirectHome />;
  }
  return <OidcCallbackInner />;
}
