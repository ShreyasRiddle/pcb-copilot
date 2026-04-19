import { NextRequest, NextResponse } from "next/server";
import { verifyBearerGetSub, isCognitoConfigured } from "@/lib/cognitoVerify";
import {
  createProject,
  getLatestRevision,
  getProjectMeta,
  incrementForkCount,
  putRevision,
} from "@/lib/dynamoHardware";
import { hardwareHubReady } from "@/lib/hardwareGate";
import { canViewProject } from "@/lib/hardwareAccess";
import { hardwareJsonResponse } from "@/lib/hardwareDevError";
import { copyObject, sourceZipKey } from "@/lib/s3Hardware";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!hardwareHubReady() || !isCognitoConfigured()) {
    return NextResponse.json(
      { error: "Hardware hub is not configured on this server." },
      { status: 503 }
    );
  }
  const sub = await verifyBearerGetSub(req.headers.get("authorization"));
  if (!sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: sourceProjectId } = await ctx.params;
  if (!sourceProjectId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const sourceMeta = await getProjectMeta(sourceProjectId);
  if (!sourceMeta || !canViewProject(sourceMeta, sub)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sourceRev = await getLatestRevision(sourceProjectId);
  if (!sourceRev) {
    return NextResponse.json({ error: "Nothing to fork — no revision uploaded." }, { status: 400 });
  }

  const newProject = await createProject({
    ownerSub: sub,
    title: `Fork of ${sourceMeta.title}`,
    description: sourceMeta.description,
    licenseSpdx: sourceMeta.licenseSpdx,
    visibility: "private",
    readmeMarkdown: sourceMeta.readmeMarkdown,
    forkedFromProjectId: sourceProjectId,
    forkedFromRevisionId: sourceRev.revisionId,
  });

  const newRevisionId = randomUUID();
  const destKey = sourceZipKey(sub, newProject.projectId, newRevisionId);

  try {
    await copyObject(sourceRev.s3Key, destKey);
  } catch (e) {
    console.error("fork copy", e);
    return hardwareJsonResponse(500, "Failed to copy project files", e);
  }

  try {
    await putRevision({
      projectId: newProject.projectId,
      ownerSub: sub,
      revisionId: newRevisionId,
      s3Key: destKey,
      sizeBytes: sourceRev.sizeBytes,
      sha256: sourceRev.sha256,
      fileManifest: sourceRev.fileManifest,
      bomRaw: sourceRev.bomRaw,
      pcbStats: sourceRev.pcbStats,
      bomEnriched: sourceRev.bomEnriched,
      wiringGraph: sourceRev.wiringGraph ?? null,
      analysisStatus: sourceRev.analysisStatus,
      analysisError: sourceRev.analysisError,
    });
    await incrementForkCount(sourceProjectId);
  } catch (e) {
    console.error("fork putRevision", e);
    return hardwareJsonResponse(500, "Failed to save fork metadata", e);
  }

  return NextResponse.json({
    id: newProject.projectId,
    title: newProject.title,
    createdAt: newProject.createdAt,
  });
}
