import { isHardwareConfigured } from "./dynamoHardware";
import { isS3HardwareConfigured } from "./s3Hardware";

/** Dynamo-backed reads and metadata writes (no S3). */
export function hardwareReadReady(): boolean {
  return isHardwareConfigured();
}

/** Uploads, presigned downloads, fork (needs S3). */
export function hardwareHubReady(): boolean {
  return isHardwareConfigured() && isS3HardwareConfigured();
}
