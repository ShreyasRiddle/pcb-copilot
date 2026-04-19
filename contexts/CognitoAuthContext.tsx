"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

export type CognitoAuthContextValue = {
  email: string | null;
  loading: boolean;
  configured: boolean;
  refreshUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  signIn: (user: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (user: string, password: string) => Promise<unknown>;
  confirmSignUp: (user: string, code: string) => Promise<void>;
};

const CognitoAuthContext = createContext<CognitoAuthContextValue | null>(null);

export function CognitoAuthContextProvider({
  value,
  children,
}: {
  value: CognitoAuthContextValue;
  children: ReactNode;
}) {
  return <CognitoAuthContext.Provider value={value}>{children}</CognitoAuthContext.Provider>;
}

export function useCognitoAuth(): CognitoAuthContextValue {
  const v = useContext(CognitoAuthContext);
  if (!v) {
    throw new Error("useCognitoAuth must be used within CognitoAuthShell");
  }
  return v;
}
