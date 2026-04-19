"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getCurrentUser,
  signIn,
  signOut,
  signUp,
  confirmSignUp,
  fetchUserAttributes,
  fetchAuthSession,
} from "aws-amplify/auth";
import { configureAmplify, isAmplifyConfigured } from "@/lib/amplify-config";
import { cognitoServerProxyEnabled } from "@/lib/cognitoServerAuthConfig";
import {
  readProxySession,
  writeProxySessionFromTokens,
  updateProxySessionTokens,
  clearProxySession,
  emailFromProxyIdToken,
  proxySessionNeedsRefresh,
} from "@/lib/cognitoProxySession";
import type { CognitoAuthContextValue } from "@/contexts/CognitoAuthContext";

async function refreshProxySession(): Promise<boolean> {
  const s = readProxySession();
  if (!s) return false;
  const res = await fetch("/api/auth/cognito/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: s.username, refreshToken: s.refreshToken }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as {
    idToken?: string;
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  };
  if (!data.idToken || !data.accessToken) return false;
  updateProxySessionTokens({
    idToken: data.idToken,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? s.refreshToken,
  });
  return true;
}

/** Amplify + optional server SECRET_HASH proxy — used inside AmplifyAuthProvider only. */
export function useAmplifyCognitoAuthState(): CognitoAuthContextValue {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured] = useState(() => isAmplifyConfigured());

  const refreshUser = useCallback(async () => {
    if (cognitoServerProxyEnabled()) {
      let session = readProxySession();
      if (!session) {
        setEmail(null);
        setLoading(false);
        return;
      }
      if (proxySessionNeedsRefresh(session)) {
        const ok = await refreshProxySession();
        if (!ok) {
          clearProxySession();
          setEmail(null);
          setLoading(false);
          return;
        }
        session = readProxySession();
      }
      setEmail(session ? emailFromProxyIdToken(session.idToken) : null);
      setLoading(false);
      return;
    }

    if (!configureAmplify()) {
      setEmail(null);
      setLoading(false);
      return;
    }
    try {
      await getCurrentUser();
      const attrs = await fetchUserAttributes();
      setEmail(attrs.email ?? attrs.preferred_username ?? null);
    } catch {
      setEmail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!configured) return null;
    if (cognitoServerProxyEnabled()) {
      let session = readProxySession();
      if (!session) return null;
      if (proxySessionNeedsRefresh(session)) {
        const ok = await refreshProxySession();
        if (!ok) {
          clearProxySession();
          return null;
        }
        session = readProxySession();
      }
      return session?.idToken ?? null;
    }
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() ?? null;
    } catch {
      return null;
    }
  }, [configured]);

  const doSignIn = useCallback(
    async (user: string, password: string) => {
      if (cognitoServerProxyEnabled()) {
        const res = await fetch("/api/auth/cognito/sign-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: user.trim(), password }),
        });
        const data = (await res.json()) as {
          idToken?: string;
          accessToken?: string;
          refreshToken?: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "Sign in failed");
        }
        if (!data.idToken || !data.accessToken || !data.refreshToken) {
          throw new Error("Invalid server response");
        }
        writeProxySessionFromTokens(user.trim(), {
          idToken: data.idToken,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });
        await refreshUser();
        return;
      }
      configureAmplify();
      await signIn({ username: user, password });
      await refreshUser();
    },
    [refreshUser]
  );

  const doSignOut = useCallback(async () => {
    if (cognitoServerProxyEnabled()) {
      clearProxySession();
      setEmail(null);
      return;
    }
    configureAmplify();
    await signOut();
    setEmail(null);
  }, []);

  const doSignUp = useCallback(async (user: string, password: string) => {
    if (cognitoServerProxyEnabled()) {
      const res = await fetch("/api/auth/cognito/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.trim(), password }),
      });
      const data = (await res.json()) as {
        userSub?: string;
        userConfirmed?: boolean;
        nextStep?: { signUpStep?: string };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Sign up failed");
      }
      return {
        isSignUpComplete: data.userConfirmed === true,
        nextStep: data.nextStep,
      };
    }
    configureAmplify();
    return signUp({
      username: user,
      password,
      options: { userAttributes: { email: user } },
    });
  }, []);

  const doConfirmSignUp = useCallback(async (user: string, code: string) => {
    if (cognitoServerProxyEnabled()) {
      const res = await fetch("/api/auth/cognito/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.trim(), confirmationCode: code }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Confirmation failed");
      }
      return;
    }
    configureAmplify();
    await confirmSignUp({ username: user, confirmationCode: code });
  }, []);

  return {
    email,
    loading,
    configured,
    refreshUser,
    getIdToken,
    signIn: doSignIn,
    signOut: doSignOut,
    signUp: doSignUp,
    confirmSignUp: doConfirmSignUp,
  };
}
