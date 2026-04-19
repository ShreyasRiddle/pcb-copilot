"use client";

import { AuthProvider } from "react-oidc-context";
import { AmplifyAuthProvider } from "@/components/AmplifyAuthProvider";
import { HostedOidcAuthProvider } from "@/components/HostedOidcAuthProvider";
import { usePreferAmplifyBypass } from "@/hooks/usePreferAmplifyBypass";
import { cognitoHostedUiReady, getCognitoOidcUserManagerSettings } from "@/lib/oidcCognitoConfig";

export function CognitoAuthShell({
  children,
  skipOidcSigninCallback = false,
}: {
  children: React.ReactNode;
  /** Set by middleware when Cognito redirects with ?error= (avoids OIDC state errors on refresh). */
  skipOidcSigninCallback?: boolean;
}) {
  const preferAmplify = usePreferAmplifyBypass();
  const oidc = getCognitoOidcUserManagerSettings();

  if (preferAmplify) {
    return <AmplifyAuthProvider>{children}</AmplifyAuthProvider>;
  }

  if (cognitoHostedUiReady() && oidc) {
    return (
      <AuthProvider
        {...oidc}
        skipSigninCallback={skipOidcSigninCallback}
        onSigninCallback={() => {
          if (typeof window === "undefined") return;
          window.history.replaceState({}, document.title, window.location.pathname);
        }}
      >
        <HostedOidcAuthProvider>{children}</HostedOidcAuthProvider>
      </AuthProvider>
    );
  }

  return <AmplifyAuthProvider>{children}</AmplifyAuthProvider>;
}
