import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  NotAuthorizedException,
} from "@aws-sdk/client-cognito-identity-provider";
import { cognitoSecretHash } from "@/lib/cognitoSecretHash";
import {
  cognitoServerProxyEnabled,
  getServerCognitoSecretClient,
} from "@/lib/cognitoServerAuthConfig";

export async function POST(req: NextRequest) {
  if (!cognitoServerProxyEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const cfg = getServerCognitoSecretClient();
  if (!cfg) {
    return NextResponse.json(
      { error: "Set COGNITO_CLIENT_SECRET (server only)." },
      { status: 503 }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const username = body.username?.trim();
  const password = body.password;
  if (!username || !password) {
    return NextResponse.json({ error: "username and password required" }, { status: 400 });
  }

  const client = new CognitoIdentityProviderClient({ region: cfg.region });
  const secretHash = cognitoSecretHash(username, cfg.clientId, cfg.clientSecret);

  try {
    const out = await client.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: cfg.clientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          SECRET_HASH: secretHash,
        },
      })
    );
    const auth = out.AuthenticationResult;
    if (!auth?.IdToken || !auth.AccessToken || !auth.RefreshToken) {
      return NextResponse.json(
        { error: "Unexpected Cognito response — enable USER_PASSWORD_AUTH on this app client." },
        { status: 503 }
      );
    }
    return NextResponse.json({
      idToken: auth.IdToken,
      accessToken: auth.AccessToken,
      refreshToken: auth.RefreshToken,
    });
  } catch (e) {
    if (e instanceof NotAuthorizedException) {
      return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
    }
    const msg = e instanceof Error ? e.message : "Sign in failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
