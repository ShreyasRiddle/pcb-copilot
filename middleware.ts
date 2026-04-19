import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * When Cognito redirects to /auth/callback with ?error=... (e.g. invalid_scope), skip OIDC
 * signinCallback so react-oidc-context does not throw "No matching state" on refresh.
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== "/auth/callback") {
    return NextResponse.next();
  }
  if (!request.nextUrl.searchParams.has("error")) {
    return NextResponse.next();
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-oidc-oauth-error", "1");
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: "/auth/callback",
};
