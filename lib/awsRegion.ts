/** Region for AWS SDK clients. Supports both common env names. */
export function resolveAwsRegion(): string {
  return process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
}
