import { NextResponse } from "next/server";

/** When true, `GET /api/hardware/diagnostics` is available (dev or explicit flag). */
export function hardwareDiagnosticsEndpointEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.ENABLE_HARDWARE_DIAGNOSTICS === "1" ||
    process.env.ENABLE_HARDWARE_DIAGNOSTICS === "true"
  );
}

/** Attach AWS-style error details to API JSON only in local development (never in production). */
export function exposeHardwareAwsDetailsInJson(): boolean {
  return process.env.NODE_ENV === "development";
}

const INVALID_SERVER_AWS_CREDS =
  "Server AWS credentials are missing, invalid, or expired. In .env.local set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY; if you use temporary credentials, also set AWS_SESSION_TOKEN. Restart npm run dev after changes.";

function isInvalidServerAwsCredentialsError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const any = e as Record<string, unknown>;
  const name = typeof any.name === "string" ? any.name : "";
  const msg = typeof any.message === "string" ? any.message.toLowerCase() : "";
  const typ = typeof any.__type === "string" ? any.__type : "";
  if (name === "UnrecognizedClientException" || name === "InvalidSignatureException") {
    return true;
  }
  if (typ.includes("UnrecognizedClientException")) return true;
  if (msg.includes("security token") && msg.includes("invalid")) return true;
  if (msg.includes("invalidaccesskeyid")) return true;
  return false;
}

function pickAwsLikeError(
  e: unknown
): { name: string; message: string; requestId?: string } | null {
  if (!e || typeof e !== "object") return null;
  const any = e as Record<string, unknown>;
  const meta = any.$metadata as { requestId?: string } | undefined;
  if (typeof any.name === "string" && typeof any.message === "string") {
    return {
      name: any.name,
      message: any.message,
      requestId: typeof meta?.requestId === "string" ? meta.requestId : undefined,
    };
  }
  if (e instanceof Error) {
    return { name: e.name, message: e.message };
  }
  return null;
}

/** Build `{ error, dev? }` for failed hardware API responses. */
export function hardwareErrorJson(
  fallback: string,
  e?: unknown
): Record<string, unknown> {
  const body: Record<string, unknown> = { error: fallback };
  if (exposeHardwareAwsDetailsInJson() && e !== undefined) {
    const aws = pickAwsLikeError(e);
    const dev: Record<string, unknown> = {};
    if (aws) dev.aws = aws;
    if (isInvalidServerAwsCredentialsError(e)) {
      dev.hint = INVALID_SERVER_AWS_CREDS;
    }
    if (Object.keys(dev).length) body.dev = dev;
  }
  return body;
}

export function hardwareJsonResponse(
  status: number,
  fallback: string,
  e?: unknown
): NextResponse {
  const credsBad = status >= 500 && isInvalidServerAwsCredentialsError(e);
  const finalStatus = credsBad ? 503 : status;
  const finalMessage = credsBad ? INVALID_SERVER_AWS_CREDS : fallback;
  return NextResponse.json(hardwareErrorJson(finalMessage, e), {
    status: finalStatus,
  });
}
