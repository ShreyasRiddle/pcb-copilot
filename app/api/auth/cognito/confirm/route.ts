import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
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

  let body: { username?: string; confirmationCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const username = body.username?.trim();
  const code = body.confirmationCode?.trim();
  if (!username || !code) {
    return NextResponse.json({ error: "username and confirmationCode required" }, { status: 400 });
  }

  const client = new CognitoIdentityProviderClient({ region: cfg.region });
  const secretHash = cognitoSecretHash(username, cfg.clientId, cfg.clientSecret);

  try {
    await client.send(
      new ConfirmSignUpCommand({
        ClientId: cfg.clientId,
        Username: username,
        ConfirmationCode: code,
        SecretHash: secretHash,
      })
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Confirmation failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
