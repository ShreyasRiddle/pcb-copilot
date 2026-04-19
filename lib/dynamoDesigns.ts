/**
 * DynamoDB access for saved PCB designs.
 * Keys: pk = USER#<cognito_sub>, sk = DESIGN#<uuid>
 */

import { randomUUID } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  GetCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { WiringGraph } from "./types";
import { resolveAwsRegion } from "./awsRegion";

const region = resolveAwsRegion();
const tableName = process.env.DESIGNS_TABLE_NAME;

function docClient() {
  return DynamoDBDocumentClient.from(
    new DynamoDBClient({ region }),
    { marshallOptions: { removeUndefinedValues: true } }
  );
}

export interface SavedDesignRecord {
  designId: string;
  title: string;
  prompt: string;
  wiringGraph: WiringGraph;
  createdAt: string;
  updatedAt: string;
}

export interface SavedDesignSummary {
  designId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

function assertTable(): string {
  if (!tableName) throw new Error("DESIGNS_TABLE_NAME is not configured");
  return tableName;
}

export async function createDesign(
  userSub: string,
  input: { title: string; prompt?: string; wiringGraph: WiringGraph }
): Promise<SavedDesignRecord> {
  const designId = randomUUID();
  const now = new Date().toISOString();
  const pk = `USER#${userSub}`;
  const sk = `DESIGN#${designId}`;
  const item = {
    pk,
    sk,
    designId,
    title: input.title || "Untitled",
    prompt: input.prompt ?? "",
    wiringGraph: JSON.stringify(input.wiringGraph),
    createdAt: now,
    updatedAt: now,
  };

  await docClient().send(
    new PutCommand({
      TableName: assertTable(),
      Item: item,
    })
  );

  return {
    designId,
    title: item.title,
    prompt: item.prompt,
    wiringGraph: input.wiringGraph,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listDesigns(userSub: string): Promise<SavedDesignSummary[]> {
  const pk = `USER#${userSub}`;
  const res = await docClient().send(
    new QueryCommand({
      TableName: assertTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": pk,
        ":prefix": "DESIGN#",
      },
    })
  );

  const items = res.Items ?? [];
  const summaries: SavedDesignSummary[] = items.map((it) => ({
    designId: String(it.designId ?? ""),
    title: String(it.title ?? "Untitled"),
    createdAt: String(it.createdAt ?? ""),
    updatedAt: String(it.updatedAt ?? ""),
  }));
  summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return summaries;
}

export async function getDesign(
  userSub: string,
  designId: string
): Promise<SavedDesignRecord | null> {
  const res = await docClient().send(
    new GetCommand({
      TableName: assertTable(),
      Key: {
        pk: `USER#${userSub}`,
        sk: `DESIGN#${designId}`,
      },
    })
  );
  const it = res.Item;
  if (!it?.wiringGraph) return null;
  let graph: WiringGraph;
  try {
    graph = JSON.parse(String(it.wiringGraph)) as WiringGraph;
  } catch {
    return null;
  }
  return {
    designId: String(it.designId ?? designId),
    title: String(it.title ?? "Untitled"),
    prompt: String(it.prompt ?? ""),
    wiringGraph: graph,
    createdAt: String(it.createdAt ?? ""),
    updatedAt: String(it.updatedAt ?? ""),
  };
}

export async function deleteDesign(
  userSub: string,
  designId: string
): Promise<void> {
  await docClient().send(
    new DeleteCommand({
      TableName: assertTable(),
      Key: {
        pk: `USER#${userSub}`,
        sk: `DESIGN#${designId}`,
      },
    })
  );
}
