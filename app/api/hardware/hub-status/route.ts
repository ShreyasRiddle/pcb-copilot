import { NextResponse } from "next/server";
import { isCognitoConfigured } from "@/lib/cognitoVerify";
import { hardwareHubReady, hardwareReadReady } from "@/lib/hardwareGate";
import { isS3HardwareConfigured } from "@/lib/s3Hardware";

/**
 * Public readiness flags (no secrets). Lets the new-project page warn before a long upload flow.
 */
export async function GET() {
  const cognitoConfigured = isCognitoConfigured();
  const dynamoConfigured = hardwareReadReady();
  const s3Configured = isS3HardwareConfigured();
  const uploadPipelineReady = hardwareHubReady() && cognitoConfigured;

  return NextResponse.json({
    cognitoConfigured,
    dynamoConfigured,
    s3Configured,
    uploadPipelineReady,
  });
}
