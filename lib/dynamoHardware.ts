/**
 * DynamoDB access for Hardware Hub (KiCad projects).
 *
 * Table: HARDWARE_TABLE_NAME — pk (S), sk (S)
 * GSI1 PublicFeed: gsi1pk (HASH), gsi1sk (RANGE) — sparse; only public projects.
 * GSI2 OwnerProjects: ownerPk (HASH), ownerSk (RANGE) — all projects by owner.
 *
 * Star: pk=USER#sub, sk=STAR#projectId
 * Stargazer row: pk=PROJECT#id, sk=STARUSER#sub (for listing stargazers)
 * Comment: pk=PROJECT#id, sk=COMMENT#<iso>#<commentId>, entity=COMMENT
 */

import { randomUUID } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
  TransactWriteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  EnrichedBomLine,
  HardwareProjectMeta,
  HardwareRevision,
  HardwareVisibility,
  PcbStats,
  RawBomLine,
} from "./hardwareTypes";
import type { WiringGraph } from "./types";
import { resolveAwsRegion } from "./awsRegion";

const region = resolveAwsRegion();
const tableName = process.env.HARDWARE_TABLE_NAME;

function doc() {
  return DynamoDBDocumentClient.from(
    new DynamoDBClient({ region }),
    { marshallOptions: { removeUndefinedValues: true } }
  );
}

export function assertHardwareTable(): string {
  if (!tableName) throw new Error("HARDWARE_TABLE_NAME is not configured");
  return tableName;
}

export function isHardwareConfigured(): boolean {
  return Boolean(tableName);
}

function metaKey(projectId: string) {
  return { pk: `PROJECT#${projectId}`, sk: "META" };
}

export async function createProject(input: {
  ownerSub: string;
  title: string;
  description: string;
  licenseSpdx: string;
  visibility: HardwareVisibility;
  readmeMarkdown?: string;
  forkedFromProjectId?: string;
  forkedFromRevisionId?: string;
}): Promise<HardwareProjectMeta> {
  const projectId = randomUUID();
  const now = new Date().toISOString();
  const ownerPk = `USER#${input.ownerSub}`;
  const ownerSk = `CREATED#${now}#${projectId}`;

  const item: Record<string, unknown> = {
    ...metaKey(projectId),
    entity: "PROJECT",
    projectId,
    ownerSub: input.ownerSub,
    title: input.title.trim() || "Untitled",
    description: input.description ?? "",
    licenseSpdx: input.licenseSpdx || "CC-BY-4.0",
    visibility: input.visibility,
    readmeMarkdown: input.readmeMarkdown ?? "",
    starCount: 0,
    forkCount: 0,
    latestRevisionId: null,
    createdAt: now,
    updatedAt: now,
    ownerPk,
    ownerSk,
  };

  if (input.forkedFromProjectId) {
    item.forkedFromProjectId = input.forkedFromProjectId;
    item.forkedFromRevisionId = input.forkedFromRevisionId ?? "";
  }

  if (input.visibility === "public") {
    item.gsi1pk = "PUBLIC";
    item.gsi1sk = `${now}#${projectId}`;
  }

  await doc().send(
    new PutCommand({
      TableName: assertHardwareTable(),
      Item: item,
      ConditionExpression: "attribute_not_exists(pk)",
    })
  );

  return {
    projectId,
    ownerSub: input.ownerSub,
    title: String(item.title),
    description: String(item.description),
    licenseSpdx: String(item.licenseSpdx),
    visibility: input.visibility,
    readmeMarkdown: String(item.readmeMarkdown ?? ""),
    starCount: 0,
    forkCount: 0,
    forkedFromProjectId: input.forkedFromProjectId,
    forkedFromRevisionId: input.forkedFromRevisionId,
    createdAt: now,
    updatedAt: now,
    latestRevisionId: null,
  };
}

export async function getProjectMeta(projectId: string): Promise<HardwareProjectMeta | null> {
  const res = await doc().send(
    new GetCommand({
      TableName: assertHardwareTable(),
      Key: metaKey(projectId),
    })
  );
  const it = res.Item;
  if (!it || it.entity !== "PROJECT") return null;
  return itemToMeta(it as Record<string, unknown>);
}

function itemToMeta(it: Record<string, unknown>): HardwareProjectMeta {
  return {
    projectId: String(it.projectId ?? ""),
    ownerSub: String(it.ownerSub ?? ""),
    title: String(it.title ?? ""),
    description: String(it.description ?? ""),
    licenseSpdx: String(it.licenseSpdx ?? ""),
    visibility: (it.visibility as HardwareVisibility) ?? "private",
    readmeMarkdown: String(it.readmeMarkdown ?? ""),
    starCount: Number(it.starCount ?? 0),
    forkCount: Number(it.forkCount ?? 0),
    forkedFromProjectId: it.forkedFromProjectId
      ? String(it.forkedFromProjectId)
      : undefined,
    forkedFromRevisionId: it.forkedFromRevisionId
      ? String(it.forkedFromRevisionId)
      : undefined,
    createdAt: String(it.createdAt ?? ""),
    updatedAt: String(it.updatedAt ?? ""),
    latestRevisionId: it.latestRevisionId ? String(it.latestRevisionId) : null,
  };
}

export async function updateProjectVisibility(
  projectId: string,
  ownerSub: string,
  visibility: HardwareVisibility
): Promise<void> {
  const meta = await getProjectMeta(projectId);
  if (!meta || meta.ownerSub !== ownerSub) throw new Error("Forbidden");
  const now = new Date().toISOString();

  if (visibility === "public") {
    await doc().send(
      new UpdateCommand({
        TableName: assertHardwareTable(),
        Key: metaKey(projectId),
        UpdateExpression:
          "SET visibility = :v, updatedAt = :u, gsi1pk = :gpk, gsi1sk = :gsk",
        ExpressionAttributeValues: {
          ":v": visibility,
          ":u": now,
          ":gpk": "PUBLIC",
          ":gsk": `${meta.createdAt}#${projectId}`,
          ":owner": ownerSub,
        },
        ConditionExpression: "ownerSub = :owner",
      })
    );
  } else {
    await doc().send(
      new UpdateCommand({
        TableName: assertHardwareTable(),
        Key: metaKey(projectId),
        UpdateExpression: "SET visibility = :v, updatedAt = :u REMOVE gsi1pk, gsi1sk",
        ExpressionAttributeValues: {
          ":v": visibility,
          ":u": now,
          ":owner": ownerSub,
        },
        ConditionExpression: "ownerSub = :owner",
      })
    );
  }
}

export async function updateProjectFields(
  projectId: string,
  ownerSub: string,
  patch: {
    title?: string;
    description?: string;
    licenseSpdx?: string;
    readmeMarkdown?: string;
  }
): Promise<void> {
  const meta = await getProjectMeta(projectId);
  if (!meta || meta.ownerSub !== ownerSub) throw new Error("Forbidden");
  const now = new Date().toISOString();
  const sets: string[] = ["updatedAt = :u"];
  const vals: Record<string, unknown> = { ":u": now, ":owner": ownerSub };
  const names: Record<string, string> = {};
  if (patch.title !== undefined) {
    sets.push("title = :t");
    vals[":t"] = patch.title;
  }
  if (patch.description !== undefined) {
    sets.push("#desc = :d");
    names["#desc"] = "description";
    vals[":d"] = patch.description;
  }
  if (patch.licenseSpdx !== undefined) {
    sets.push("licenseSpdx = :l");
    vals[":l"] = patch.licenseSpdx;
  }
  if (patch.readmeMarkdown !== undefined) {
    sets.push("readmeMarkdown = :r");
    vals[":r"] = patch.readmeMarkdown;
  }

  await doc().send(
    new UpdateCommand({
      TableName: assertHardwareTable(),
      Key: metaKey(projectId),
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
      ExpressionAttributeValues: vals,
      ConditionExpression: "ownerSub = :owner",
    })
  );
}

export async function incrementForkCount(sourceProjectId: string): Promise<void> {
  await doc().send(
    new UpdateCommand({
      TableName: assertHardwareTable(),
      Key: metaKey(sourceProjectId),
      UpdateExpression: "SET forkCount = if_not_exists(forkCount, :z) + :one, updatedAt = :u",
      ExpressionAttributeValues: {
        ":z": 0,
        ":one": 1,
        ":u": new Date().toISOString(),
      },
    })
  );
}

export async function listPublicProjects(limit = 30): Promise<HardwareProjectMeta[]> {
  const res = await doc().send(
    new QueryCommand({
      TableName: assertHardwareTable(),
      IndexName: "PublicFeed",
      KeyConditionExpression: "gsi1pk = :p",
      ExpressionAttributeValues: { ":p": "PUBLIC" },
      ScanIndexForward: false,
      Limit: limit,
    })
  );
  const items = res.Items ?? [];
  return items.map((it) => itemToMeta(it as Record<string, unknown>));
}

function isMissingOwnerProjectsGsi(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String((err as { name?: string }).name) : "";
  const msg = "message" in err ? String((err as { message?: string }).message) : "";
  return (
    name === "ValidationException" &&
    (/OwnerProjects/i.test(msg) || /specified index/i.test(msg))
  );
}

/**
 * Fallback when the OwnerProjects GSI is missing (misconfigured table).
 * Scans the whole table — OK for small dev tables; production should add the GSI.
 */
async function listOwnerProjectsViaScan(ownerSub: string): Promise<HardwareProjectMeta[]> {
  const collected: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const res = await doc().send(
      new ScanCommand({
        TableName: assertHardwareTable(),
        FilterExpression: "entity = :proj AND ownerSub = :sub",
        ExpressionAttributeValues: {
          ":proj": "PROJECT",
          ":sub": ownerSub,
        },
        ExclusiveStartKey: startKey,
      })
    );
    collected.push(...(res.Items ?? []));
    startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);

  return collected
    .filter((it) => it.entity === "PROJECT")
    .sort((a, b) =>
      String(b.updatedAt ?? b.createdAt ?? "").localeCompare(
        String(a.updatedAt ?? a.createdAt ?? "")
      )
    )
    .map((it) => itemToMeta(it));
}

export async function listOwnerProjects(ownerSub: string): Promise<HardwareProjectMeta[]> {
  try {
    const res = await doc().send(
      new QueryCommand({
        TableName: assertHardwareTable(),
        IndexName: "OwnerProjects",
        KeyConditionExpression: "ownerPk = :o",
        ExpressionAttributeValues: { ":o": `USER#${ownerSub}` },
        ScanIndexForward: false,
      })
    );
    const items = res.Items ?? [];
    return items
      .filter((it) => it.entity === "PROJECT")
      .map((it) => itemToMeta(it as Record<string, unknown>));
  } catch (e) {
    if (!isMissingOwnerProjectsGsi(e)) throw e;
    return listOwnerProjectsViaScan(ownerSub);
  }
}

function revisionFromItem(it: Record<string, unknown>): HardwareRevision {
  let bomRaw: RawBomLine[] = [];
  let bomEnriched: EnrichedBomLine[] | null = null;
  let pcbStats: PcbStats | null = null;
  try {
    bomRaw = JSON.parse(String(it.bomRawJson ?? "[]")) as RawBomLine[];
  } catch {
    bomRaw = [];
  }
  try {
    if (it.bomEnrichedJson) {
      bomEnriched = JSON.parse(String(it.bomEnrichedJson)) as EnrichedBomLine[];
    }
  } catch {
    bomEnriched = null;
  }
  try {
    if (it.pcbStatsJson) {
      pcbStats = JSON.parse(String(it.pcbStatsJson)) as PcbStats;
    }
  } catch {
    pcbStats = null;
  }
  let wiringGraph: WiringGraph | null = null;
  try {
    if (it.wiringGraphJson) {
      wiringGraph = JSON.parse(String(it.wiringGraphJson)) as WiringGraph;
    }
  } catch {
    wiringGraph = null;
  }
  return {
    revisionId: String(it.revisionId ?? ""),
    projectId: String(it.projectId ?? ""),
    ownerSub: it.ownerSub ? String(it.ownerSub) : undefined,
    sourceKind: it.sourceKind ? (String(it.sourceKind) as HardwareRevision["sourceKind"]) : undefined,
    sourceFilename: it.sourceFilename ? String(it.sourceFilename) : undefined,
    s3Key: String(it.s3Key ?? ""),
    sizeBytes: Number(it.sizeBytes ?? 0),
    sha256: String(it.sha256 ?? ""),
    fileManifest: Array.isArray(it.fileManifest)
      ? (it.fileManifest as string[])
      : [],
    bomRaw,
    bomEnriched,
    pcbStats,
    wiringGraph,
    analysisStatus: (it.analysisStatus as HardwareRevision["analysisStatus"]) ?? "pending",
    analysisError: it.analysisError ? String(it.analysisError) : undefined,
    createdAt: String(it.createdAt ?? ""),
  };
}

export async function getRevision(
  projectId: string,
  revisionId: string
): Promise<HardwareRevision | null> {
  const res = await doc().send(
    new GetCommand({
      TableName: assertHardwareTable(),
      Key: { pk: `PROJECT#${projectId}`, sk: `REV#${revisionId}` },
    })
  );
  const it = res.Item;
  if (!it || it.entity !== "REVISION") return null;
  return revisionFromItem(it as Record<string, unknown>);
}

export async function getLatestRevision(projectId: string): Promise<HardwareRevision | null> {
  const meta = await getProjectMeta(projectId);
  if (!meta?.latestRevisionId) return null;
  return getRevision(projectId, meta.latestRevisionId);
}

export async function putRevision(input: {
  projectId: string;
  ownerSub: string;
  /** Must match the revision id used in the S3 upload URL */
  revisionId: string;
  sourceKind?: HardwareRevision["sourceKind"];
  sourceFilename?: string;
  s3Key: string;
  sizeBytes: number;
  sha256: string;
  fileManifest: string[];
  bomRaw: RawBomLine[];
  pcbStats: PcbStats | null;
  bomEnriched: EnrichedBomLine[] | null;
  wiringGraph?: WiringGraph | null;
  analysisStatus: HardwareRevision["analysisStatus"];
  analysisError?: string;
}): Promise<HardwareRevision> {
  const meta = await getProjectMeta(input.projectId);
  if (!meta || meta.ownerSub !== input.ownerSub) throw new Error("Forbidden");

  const revisionId = input.revisionId;
  const now = new Date().toISOString();

  const wiringGraph = input.wiringGraph ?? null;

  const rev: HardwareRevision = {
    revisionId,
    projectId: input.projectId,
    sourceKind: input.sourceKind,
    sourceFilename: input.sourceFilename,
    s3Key: input.s3Key,
    sizeBytes: input.sizeBytes,
    sha256: input.sha256,
    fileManifest: input.fileManifest,
    bomRaw: input.bomRaw,
    bomEnriched: input.bomEnriched,
    pcbStats: input.pcbStats,
    wiringGraph,
    analysisStatus: input.analysisStatus,
    analysisError: input.analysisError,
    createdAt: now,
  };

  await doc().send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: assertHardwareTable(),
            Item: {
              pk: `PROJECT#${input.projectId}`,
              sk: `REV#${revisionId}`,
              entity: "REVISION",
              ownerSub: input.ownerSub,
              revisionId,
              projectId: input.projectId,
              sourceKind: input.sourceKind ?? null,
              sourceFilename: input.sourceFilename ?? null,
              s3Key: input.s3Key,
              sizeBytes: input.sizeBytes,
              sha256: input.sha256,
              fileManifest: input.fileManifest,
              bomRawJson: JSON.stringify(input.bomRaw),
              bomEnrichedJson: input.bomEnriched
                ? JSON.stringify(input.bomEnriched)
                : null,
              pcbStatsJson: input.pcbStats ? JSON.stringify(input.pcbStats) : null,
              wiringGraphJson: wiringGraph ? JSON.stringify(wiringGraph) : null,
              analysisStatus: input.analysisStatus,
              analysisError: input.analysisError ?? null,
              createdAt: now,
            },
          },
        },
        {
          Update: {
            TableName: assertHardwareTable(),
            Key: metaKey(input.projectId),
            UpdateExpression: "SET latestRevisionId = :r, updatedAt = :u",
            ExpressionAttributeValues: {
              ":r": revisionId,
              ":u": now,
              ":owner": input.ownerSub,
            },
            ConditionExpression: "ownerSub = :owner",
          },
        },
      ],
    })
  );

  return rev;
}

export async function updateRevisionAnalysis(
  projectId: string,
  revisionId: string,
  ownerSub: string,
  patch: {
    bomEnriched?: EnrichedBomLine[] | null;
    pcbStats?: PcbStats | null;
    analysisStatus: HardwareRevision["analysisStatus"];
    analysisError?: string;
  }
): Promise<void> {
  const meta = await getProjectMeta(projectId);
  if (!meta || meta.ownerSub !== ownerSub) throw new Error("Forbidden");

  const vals: Record<string, unknown> = {
    ":owner": ownerSub,
    ":st": patch.analysisStatus,
  };
  let set = "analysisStatus = :st";
  if (patch.bomEnriched !== undefined) {
    set += ", bomEnrichedJson = :bej";
    vals[":bej"] = patch.bomEnriched ? JSON.stringify(patch.bomEnriched) : null;
  }
  if (patch.pcbStats !== undefined) {
    set += ", pcbStatsJson = :psj";
    vals[":psj"] = patch.pcbStats ? JSON.stringify(patch.pcbStats) : null;
  }
  if (patch.analysisError !== undefined) {
    set += ", analysisError = :ae";
    vals[":ae"] = patch.analysisError ?? null;
  }

  await doc().send(
    new UpdateCommand({
      TableName: assertHardwareTable(),
      Key: { pk: `PROJECT#${projectId}`, sk: `REV#${revisionId}` },
      UpdateExpression: `SET ${set}`,
      ExpressionAttributeValues: vals,
      ConditionExpression: "ownerSub = :owner",
    })
  );
}

export async function isStarred(userSub: string, projectId: string): Promise<boolean> {
  const res = await doc().send(
    new GetCommand({
      TableName: assertHardwareTable(),
      Key: { pk: `USER#${userSub}`, sk: `STAR#${projectId}` },
    })
  );
  return Boolean(res.Item?.entity === "STAR");
}

export async function setStar(userSub: string, projectId: string, star: boolean): Promise<void> {
  const now = new Date().toISOString();
  if (star) {
    try {
      await doc().send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: assertHardwareTable(),
                Item: {
                  pk: `USER#${userSub}`,
                  sk: `STAR#${projectId}`,
                  entity: "STAR",
                  projectId,
                  createdAt: now,
                },
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
            {
              Put: {
                TableName: assertHardwareTable(),
                Item: {
                  pk: `PROJECT#${projectId}`,
                  sk: `STARUSER#${userSub}`,
                  entity: "STARGAZER",
                  userSub,
                  createdAt: now,
                },
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
            {
              Update: {
                TableName: assertHardwareTable(),
                Key: metaKey(projectId),
                UpdateExpression:
                  "SET starCount = if_not_exists(starCount, :z) + :one, updatedAt = :u",
                ExpressionAttributeValues: {
                  ":z": 0,
                  ":one": 1,
                  ":u": now,
                },
              },
            },
          ],
        })
      );
    } catch {
      /* already starred */
    }
  } else {
    try {
      await doc().send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: assertHardwareTable(),
                Key: { pk: `USER#${userSub}`, sk: `STAR#${projectId}` },
              },
            },
            {
              Delete: {
                TableName: assertHardwareTable(),
                Key: { pk: `PROJECT#${projectId}`, sk: `STARUSER#${userSub}` },
              },
            },
            {
              Update: {
                TableName: assertHardwareTable(),
                Key: metaKey(projectId),
                UpdateExpression: "SET starCount = starCount - :one, updatedAt = :u",
                ExpressionAttributeValues: {
                  ":one": 1,
                  ":u": now,
                  ":min": 0,
                },
                ConditionExpression: "starCount > :min",
              },
            },
          ],
        })
      );
    } catch {
      /* not starred */
    }
  }
}
