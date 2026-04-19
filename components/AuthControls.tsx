"use client";

import { useState, useEffect } from "react";
import { useCognitoAuth } from "@/hooks/useCognitoAuth";
import { usePreferAmplifyBypass } from "@/hooks/usePreferAmplifyBypass";
import {
  clearPreferAmplifyBypass,
  setPreferAmplifyBypass,
} from "@/lib/cognitoAuthBypass";
import {
  cognitoHostedUiEnabled,
  cognitoHostedUiReady,
} from "@/lib/oidcCognitoConfig";

/** Stable SSR + first client paint — avoids branch mismatch when env differs between server and browser. */
const AUTH_PLACEHOLDER_STYLE = {
  fontSize: 12,
  color: "var(--text-3)",
} as const;

export default function AuthControls() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    email,
    loading,
    configured,
    signIn,
    signOut,
    signUp,
    confirmSignUp,
  } = useCognitoAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup" | "confirm">("signin");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const amplifyBypass = usePreferAmplifyBypass();

  if (!mounted) {
    return (
      <span style={AUTH_PLACEHOLDER_STYLE} aria-busy="true">
        ...
      </span>
    );
  }

  if (cognitoHostedUiEnabled() && !cognitoHostedUiReady()) {
    return (
      <span
        style={AUTH_PLACEHOLDER_STYLE}
        title="Set NEXT_PUBLIC_COGNITO_USE_HOSTED_UI=1 plus OIDC redirect URI, authority or pool id, client id, and Hosted UI domain."
      >
        Hosted UI misconfigured
      </span>
    );
  }

  if (!configured) {
    return (
      <span
        style={AUTH_PLACEHOLDER_STYLE}
        title="Set Cognito env vars: NEXT_PUBLIC_COGNITO_USER_POOL_ID and NEXT_PUBLIC_COGNITO_CLIENT_ID"
      >
        Sign-in unavailable
      </span>
    );
  }

  if (loading) {
    return (
      <span style={AUTH_PLACEHOLDER_STYLE} aria-busy="true">
        ...
      </span>
    );
  }

  if (email && !open) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-2)",
            maxWidth: 160,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={email}
        >
          {email}
        </span>
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: "4px 10px", fontSize: 12 }}
          onClick={() => {
            setBusy(true);
            signOut().finally(() => setBusy(false));
          }}
          disabled={busy}
        >
          Sign out
        </button>
        {cognitoHostedUiEnabled() && amplifyBypass ? (
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: "4px 10px", fontSize: 11, color: "var(--text-3)" }}
            onClick={() => {
              clearPreferAmplifyBypass();
              window.location.reload();
            }}
          >
            Try Hosted UI again
          </button>
        ) : null}
      </div>
    );
  }

  if (cognitoHostedUiReady() && !amplifyBypass && !email) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: "5px 12px", fontSize: 12 }}
          onClick={() => {
            setError(null);
            setBusy(true);
            signIn("", "")
              .catch((e) => setError(e instanceof Error ? e.message : "Sign-in failed"))
              .finally(() => setBusy(false));
          }}
          disabled={busy}
        >
          Sign in
        </button>
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: "5px 12px", fontSize: 12 }}
          onClick={() => {
            setError(null);
            setBusy(true);
            signUp("", "")
              .catch((e) => setError(e instanceof Error ? e.message : "Sign-up failed"))
              .finally(() => setBusy(false));
          }}
          disabled={busy}
        >
          Create account
        </button>
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: "4px 8px", fontSize: 11, color: "var(--text-3)" }}
          title="Use this if Hosted UI shows login pages unavailable"
          onClick={() => {
            setPreferAmplifyBypass();
            window.location.reload();
          }}
        >
          Email &amp; password
        </button>
        {error ? (
          <span style={{ fontSize: 11, color: "#f87171" }}>{error}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {!email && (
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: "5px 12px", fontSize: 12 }}
          onClick={() => {
            setOpen((o) => !o);
            setError(null);
          }}
        >
          Sign in
        </button>
      )}

      {open && !email && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            marginTop: 8,
            width: 280,
            padding: 14,
            borderRadius: 12,
            background: "var(--bg-card)",
            border: "1px solid var(--border-mid)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
            zIndex: 200,
          }}
        >
          {mode === "confirm" ? (
            <>
              <p style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 10 }}>
                Enter the verification code sent to your email.
              </p>
              <input
                type="text"
                placeholder="Code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={{
                  width: "100%",
                  marginBottom: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-1)",
                  fontSize: 13,
                }}
              />
              <button
                type="button"
                className="btn-ghost"
                style={{ width: "100%", padding: "8px", fontSize: 13 }}
                onClick={async () => {
                  setError(null);
                  setBusy(true);
                  try {
                    await confirmSignUp(user, code);
                    setMode("signin");
                    setCode("");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Confirmation failed");
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
              >
                Confirm
              </button>
            </>
          ) : (
            <>
              <input
                type="email"
                placeholder="Email"
                autoComplete="email"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                style={{
                  width: "100%",
                  marginBottom: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-1)",
                  fontSize: 13,
                }}
              />
              <input
                type="password"
                placeholder="Password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  marginBottom: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-1)",
                  fontSize: 13,
                }}
              />
              {error && (
                <p style={{ fontSize: 11, color: "#f87171", marginBottom: 8 }}>{error}</p>
              )}
              <button
                type="button"
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  border: "1px solid rgba(110,231,247,0.35)",
                  background: "rgba(110,231,247,0.12)",
                  color: "var(--accent)",
                  cursor: "pointer",
                  marginBottom: 8,
                }}
                onClick={async () => {
                  setError(null);
                  setBusy(true);
                  try {
                    if (mode === "signin") {
                      await signIn(user, password);
                      setOpen(false);
                      setPassword("");
                    } else {
                      const out = await signUp(user, password);
                      const step = (
                        out as { nextStep?: { signUpStep?: string } }
                      ).nextStep?.signUpStep;
                      if (step === "CONFIRM_SIGN_UP") {
                        setMode("confirm");
                      } else {
                        setMode("signin");
                      }
                    }
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Auth failed");
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
              >
                {mode === "signin" ? "Sign in" : "Create account"}
              </button>
              <button
                type="button"
                style={{
                  width: "100%",
                  background: "none",
                  border: "none",
                  color: "var(--text-3)",
                  fontSize: 11,
                  cursor: "pointer",
                }}
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError(null);
                }}
              >
                {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
