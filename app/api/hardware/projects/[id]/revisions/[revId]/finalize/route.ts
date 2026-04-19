import { NextRequest, NextResponse } from "next/server";
import { verifyBearerGetSub, isCognitoConfigured } from "@/lib/cognitoVerify";
import { getProjectMeta } from "@/lib/dynamoHardware";
import { hardwareHubReady } from "@/lib/hardwareGate";
import { canEditProject } from "@/lib/hardwareAccess";
import { finalizeHardwareRevision } from "@/lib/hardwareFinalize";
import { hardwareErrorJson } from "@/lib/hardwareDevError";
import { deleteObject, sourceZipKey } from "@/lib/s3Hardware";

export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; revId: string }> }
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
  const { id: projectId, revId: revisionId } = await ctx.params;
  if (!projectId || !revisionId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const meta = await getProjectMeta(projectId);
  if (!meta || !canEditProject(meta, sub)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { sizeBytes?: number; sha256?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sizeBytes = body.sizeBytes;
  const sha256 = body.sha256?.trim();
  if (typeof sizeBytes !== "number" || sizeBytes <= 0 || !sha256) {
    return NextResponse.json(
      { error: "sizeBytes and sha256 are required" },
      { status: 400 }
    );
  }

  const s3Key = sourceZipKey(sub, projectId, revisionId);

  try {
    const revision = await finalizeHardwareRevision({
      projectId,
      ownerSub: sub,
      revisionId,
      s3Key,
      declaredSize: sizeBytes,
      declaredSha256: sha256,
    });
    return NextResponse.json({ revision });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Finalize failed";
    console.error("finalize revision", e);
    try {
      await deleteObject(s3Key);
    } catch (delErr) {
      console.error("finalize revision S3 cleanup", delErr);
    }
    return NextResponse.json(hardwareErrorJson(msg, e), { status: 400 });
  }
}
