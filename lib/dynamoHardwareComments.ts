/**
 * Project comments: pk=PROJECT#id, sk=COMMENT#<iso>#<commentId>
 */

import { randomUUID } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { assertHardwareTable } from "./dynamoHardware";
import type { HardwareComment } from "./hardwareTypes";
import { resolveAwsRegion } from "./awsRegion";

const region = resolveAwsRegion();

function doc() {
  return DynamoDBDocumentClient.from(
    new DynamoDBClient({ region }),
    { marshallOptions: { removeUndefinedValues: true } }
  );
}

function itemToComment(projectId: string, it: Record<string, unknown>): HardwareComment | null {
  if (it.entity !== "COMMENT") return null;
  return {
    commentId: String(it.commentId ?? ""),
    projectId,
    authorSub: String(it.authorSub ?? ""),
    body: String(it.body ?? ""),
    createdAt: String(it.createdAt ?? ""),
  };
}

export async function listProjectComments(projectId: string, limit = 100): Promise<HardwareComment[]> {
  const res = await doc().send(
    new QueryCommand({
      TableName: assertHardwareTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `PROJECT#${projectId}`,
        ":prefix": "COMMENT#",
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );
  const items = res.Items ?? [];
  const out: HardwareComment[] = [];
  for (const raw of items) {
    const c = itemToComment(projectId, raw as Record<string, unknown>);
    if (c?.commentId) out.push(c);
  }
  return out;
}

export async function putProjectComment(input: {
  projectId: string;
  authorSub: string;
  body: string;
}): Promise<HardwareComment> {
  const commentId = randomUUID();
  const createdAt = new Date().toISOString();
  const sk = `COMMENT#${createdAt}#${commentId}`;

  await doc().send(
    new PutCommand({
      TableName: assertHardwareTable(),
      Item: {
        pk: `PROJECT#${input.projectId}`,
        sk,
        entity: "COMMENT",
        commentId,
        projectId: input.projectId,
        authorSub: input.authorSub,
        body: input.body,
        createdAt,
      },
    })
  );

  return {
    commentId,
    projectId: input.projectId,
    authorSub: input.authorSub,
    body: input.body,
    createdAt,
  };
}
