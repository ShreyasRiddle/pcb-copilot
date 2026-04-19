/**
 * Server-side checks for Hardware hub AWS wiring (Dynamo GSIs, S3 bucket reachability).
 * Browser S3 CORS cannot be validated here — see `notes` in the report.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { resolveAwsRegion } from "./awsRegion";
import { hardwareHubReady } from "./hardwareGate";
import { isCognitoConfigured } from "./cognitoVerify";

type StepResult = { ok: true } | { ok: false; error: string };

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

async function checkDynamoGsi(
  tableName: string,
  indexName: string,
  keyCondition: string,
  exprValues: Record<string, string | number>
): Promise<StepResult> {
  const region = resolveAwsRegion();
  const doc = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region }),
    { marshallOptions: { removeUndefinedValues: true } }
  );
  try {
    await doc.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: indexName,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeValues: exprValues,
        Limit: 1,
      })
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

async function checkS3Head(bucket: string): Promise<StepResult> {
  const region = resolveAwsRegion();
  const client = new S3Client({ region });
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export interface HardwareDiagnosticsReport {
  environment: {
    nodeEnv: string | undefined;
    hardwareHubReady: boolean;
    hardwareTableNameSet: boolean;
    hardwareBucketSet: boolean;
    cognitoConfigured: boolean;
    geminiConfigured: boolean;
    resolvedAwsRegion: string;
  };
  dynamodb: {
    publicFeedGsi: StepResult;
    ownerProjectsGsi: StepResult;
  };
  s3: {
    headBucket: StepResult;
  };
  notes: string[];
}

export async function runHardwareDiagnosticsReport(): Promise<HardwareDiagnosticsReport> {
  const table = process.env.HARDWARE_TABLE_NAME;
  const bucket = process.env.HARDWARE_PROJECTS_BUCKET;
  const notes = [
    "S3 CORS (browser PUT to presigned URL) is not verified by this endpoint. Configure bucket CORS for your app origin (e.g. http://localhost:3000).",
    "Ordered API smoke: GET /api/hardware/projects?scope=public → POST /api/hardware/projects (auth) → POST .../upload → PUT uploadUrl → POST .../finalize.",
  ];

  let publicFeed: StepResult = { ok: false, error: "Skipped" };
  let ownerGsi: StepResult = { ok: false, error: "Skipped" };
  let headBucket: StepResult = { ok: false, error: "Skipped" };

  if (table) {
    publicFeed = await checkDynamoGsi(table, "PublicFeed", "gsi1pk = :p", { ":p": "PUBLIC" });
    ownerGsi = await checkDynamoGsi(table, "OwnerProjects", "ownerPk = :o", {
      ":o": "USER#__hw_diag__",
    });
  } else {
    publicFeed = { ok: false, error: "HARDWARE_TABLE_NAME not set" };
    ownerGsi = { ok: false, error: "HARDWARE_TABLE_NAME not set" };
  }

  if (bucket) {
    headBucket = await checkS3Head(bucket);
  } else {
    headBucket = { ok: false, error: "HARDWARE_PROJECTS_BUCKET not set" };
  }

  return {
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hardwareHubReady: hardwareHubReady(),
      hardwareTableNameSet: Boolean(table),
      hardwareBucketSet: Boolean(bucket),
      cognitoConfigured: isCognitoConfigured(),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      resolvedAwsRegion: resolveAwsRegion(),
    },
    dynamodb: {
      publicFeedGsi: publicFeed,
      ownerProjectsGsi: ownerGsi,
    },
    s3: {
      headBucket,
    },
    notes,
  };
}
