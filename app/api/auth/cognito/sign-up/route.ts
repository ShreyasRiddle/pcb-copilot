import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  UsernameExistsException,
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
      { error: "Set COGNITO_CLIENT_SECRET (server only) with your Cognito app client secret." },
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
      new SignUpCommand({
        ClientId: cfg.clientId,
        Username: username,
        Password: password,
        SecretHash: secretHash,
        UserAttributes: [{ Name: "email", Value: username }],
      })
    );
    return NextResponse.json({
      userSub: out.UserSub,
      userConfirmed: out.UserConfirmed === true,
      nextStep:
        out.UserConfirmed === true ?
          undefined
        : { signUpStep: "CONFIRM_SIGN_UP" as const },
    });
  } catch (e) {
    if (e instanceof UsernameExistsException) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }
    const msg = e instanceof Error ? e.message : "Sign up failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
