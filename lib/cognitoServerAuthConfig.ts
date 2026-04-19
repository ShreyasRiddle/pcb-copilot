/**
 * Server-only Cognito app client with client secret (SECRET_HASH flows).
 * Browser Amplify cannot use a confidential client; use NEXT_PUBLIC_COGNITO_SERVER_AUTH + these env vars.
 */

export function cognitoServerProxyEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_COGNITO_SERVER_AUTH === "1" ||
    process.env.NEXT_PUBLIC_COGNITO_SERVER_AUTH === "true"
  );
}

export function getServerCognitoSecretClient():
  | {
      region: string;
      userPoolId: string;
      clientId: string;
      clientSecret: string;
    }
  | null {
  const userPoolId =
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? process.env.COGNITO_USER_POOL_ID;
  const clientId =
    process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? process.env.COGNITO_CLIENT_ID;
  const clientSecret = process.env.COGNITO_CLIENT_SECRET?.trim();
  if (!userPoolId || !clientId || !clientSecret) return null;
  const u = userPoolId.indexOf("_");
  const region =
    u > 0 ? userPoolId.slice(0, u) : process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
  return { region, userPoolId, clientId, clientSecret };
}
