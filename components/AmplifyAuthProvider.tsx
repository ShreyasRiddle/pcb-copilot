"use client";

import { CognitoAuthContextProvider } from "@/contexts/CognitoAuthContext";
import { useAmplifyCognitoAuthState } from "@/hooks/useAmplifyCognitoAuthState";

export function AmplifyAuthProvider({ children }: { children: React.ReactNode }) {
  const value = useAmplifyCognitoAuthState();
  return <CognitoAuthContextProvider value={value}>{children}</CognitoAuthContextProvider>;
}
