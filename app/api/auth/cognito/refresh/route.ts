import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
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

  let body: { username?: string; refreshToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const username = body.username?.trim();
  const refreshToken = body.refreshToken?.trim();
  if (!username || !refreshToken) {
    return NextResponse.json({ error: "username and refreshToken required" }, { status: 400 });
  }

  const client = new CognitoIdentityProviderClient({ region: cfg.region });
  const secretHash = cognitoSecretHash(username, cfg.clientId, cfg.clientSecret);

  try {
    const out = await client.send(
      new InitiateAuthCommand({
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: cfg.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
          SECRET_HASH: secretHash,
        },
      })
    );
    const auth = out.AuthenticationResult;
    if (!auth?.IdToken || !auth.AccessToken) {
      return NextResponse.json({ error: "Refresh failed" }, { status: 401 });
    }
    return NextResponse.json({
      idToken: auth.IdToken,
      accessToken: auth.AccessToken,
      refreshToken: auth.RefreshToken ?? refreshToken,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Refresh failed";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
