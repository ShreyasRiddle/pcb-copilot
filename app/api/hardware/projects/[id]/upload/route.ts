import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { verifyBearerGetSub, isCognitoConfigured } from "@/lib/cognitoVerify";
import { getProjectMeta } from "@/lib/dynamoHardware";
import { hardwareHubReady } from "@/lib/hardwareGate";
import { canEditProject } from "@/lib/hardwareAccess";
import { hardwareJsonResponse } from "@/lib/hardwareDevError";
import { presignedPutZip } from "@/lib/s3Hardware";

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
  const { id: projectId } = await ctx.params;
  if (!projectId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const meta = await getProjectMeta(projectId);
  if (!meta || !canEditProject(meta, sub)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const revisionId = randomUUID();
  try {
    const { url, key } = await presignedPutZip(sub, projectId, revisionId);
    return NextResponse.json({
      revisionId,
      uploadUrl: url,
      s3Key: key,
      expiresIn: 3600,
    });
  } catch (e) {
    console.error("presigned upload", e);
    return hardwareJsonResponse(500, "Could not create upload URL", e);
  }
}
