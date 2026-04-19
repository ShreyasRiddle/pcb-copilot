"use client";

import { useMemo, useCallback, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { CognitoAuthContextProvider } from "@/contexts/CognitoAuthContext";
import type { CognitoAuthContextValue } from "@/contexts/CognitoAuthContext";
import { buildCognitoHostedLogoutUrl } from "@/lib/oidcCognitoConfig";

function profileEmail(auth: ReturnType<typeof useAuth>): string | null {
  const p = auth.user?.profile;
  if (!p) return null;
  if (typeof p.email === "string" && p.email) return p.email;
  if (typeof p.preferred_username === "string" && p.preferred_username) {
    return p.preferred_username;
  }
  return typeof p.sub === "string" ? p.sub : null;
}

export function HostedOidcAuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.error) return;
    const msg = auth.error.message ?? "";
    const benign =
      msg.includes("invalid_scope") ||
      msg.includes("state") ||
      msg.includes("storage") ||
      auth.error.name === "ErrorResponse";
    if (benign && process.env.NODE_ENV === "development") {
      console.warn("OIDC:", msg);
    } else if (!benign) {
      console.error("OIDC auth error", auth.error);
    }
  }, [auth.error]);

  const refreshUser = useCallback(async () => {
    try {
      await auth.signinSilent();
    } catch {
      /* expected when no session */
    }
  }, [auth]);

  const value = useMemo((): CognitoAuthContextValue => {
    const email = profileEmail(auth);
    return {
      email,
      loading: auth.isLoading,
      configured: true,
      refreshUser,
      getIdToken: async () => auth.user?.id_token ?? null,
      signIn: async () => {
        await auth.signinRedirect();
      },
      signOut: async () => {
        await auth.removeUser();
        const logout = buildCognitoHostedLogoutUrl();
        if (logout && typeof window !== "undefined") {
          window.location.assign(logout);
        }
      },
      signUp: async () => {
        await auth.signinRedirect();
      },
      confirmSignUp: async () => {
        throw new Error(
          "Hosted UI: confirm your account using the link in the email from Cognito, then sign in here."
        );
      },
    };
  }, [auth, refreshUser]);

  return <CognitoAuthContextProvider value={value}>{children}</CognitoAuthContextProvider>;
}
