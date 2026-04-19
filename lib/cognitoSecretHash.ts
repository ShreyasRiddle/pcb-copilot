import { createHmac } from "crypto";

/** AWS Cognito SECRET_HASH for app clients that have a client secret. */
export function cognitoSecretHash(
  username: string,
  clientId: string,
  clientSecret: string
): string {
  return createHmac("sha256", clientSecret)
    .update(username + clientId)
    .digest("base64");
}
