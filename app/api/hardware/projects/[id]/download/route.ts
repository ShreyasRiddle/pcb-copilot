import { NextRequest, NextResponse } from "next/server";
import { verifyBearerGetSub, isCognitoConfigured } from "@/lib/cognitoVerify";
import { getProjectMeta, getRevision } from "@/lib/dynamoHardware";
import { hardwareHubReady } from "@/lib/hardwareGate";
import { canViewProject } from "@/lib/hardwareAccess";
import { hardwareJsonResponse } from "@/lib/hardwareDevError";
import { presignedGetZip } from "@/lib/s3Hardware";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!hardwareHubReady()) {
    return NextResponse.json(
      { error: "Hardware hub is not configured on this server." },
      { status: 503 }
    );
  }
  const { id: projectId } = await ctx.params;
  if (!projectId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const sub = await verifyBearerGetSub(req.headers.get("authorization"));
  const meta = await getProjectMeta(projectId);
  if (!meta || !canViewProject(meta, sub)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const revisionId = req.nextUrl.searchParams.get("revisionId") ?? meta.latestRevisionId;
  if (!revisionId) {
    return NextResponse.json({ error: "No revision uploaded yet" }, { status: 400 });
  }

  const rev = await getRevision(projectId, revisionId);
  if (!rev) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }

  try {
    const url = await presignedGetZip(rev.s3Key);
    const safeTitle = meta.title.replace(/[^a-z0-9-_]+/gi, "_");
    const ext = rev.sourceKind === "skidl_py" ? "py" : "zip";
    const fallbackName = `${safeTitle}_${revisionId.slice(0, 8)}.${ext}`;
    return NextResponse.json({
      url,
      filename: rev.sourceFilename
        ? `${safeTitle}_${revisionId.slice(0, 8)}_${rev.sourceFilename}`
        : fallbackName,
      sha256: rev.sha256,
    });
  } catch (e) {
    console.error("download presign", e);
    return hardwareJsonResponse(500, "Could not create download link", e);
  }
}
