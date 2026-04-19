import { NextRequest, NextResponse } from "next/server";
import { verifyBearerGetSub, isCognitoConfigured } from "@/lib/cognitoVerify";
import { getProjectMeta, isStarred, setStar } from "@/lib/dynamoHardware";
import { hardwareReadReady } from "@/lib/hardwareGate";
import { hardwareJsonResponse } from "@/lib/hardwareDevError";
import { canViewProject } from "@/lib/hardwareAccess";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!hardwareReadReady() || !isCognitoConfigured()) {
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
  if (!meta || !canViewProject(meta, sub)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { star?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const star = body.star === true;

  try {
    await setStar(sub, projectId, star);
    const updated = await getProjectMeta(projectId);
    return NextResponse.json({
      starred: star,
      starCount: updated?.starCount ?? 0,
    });
  } catch (e) {
    console.error("star", e);
    return hardwareJsonResponse(500, "Star update failed", e);
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!hardwareReadReady()) {
    return NextResponse.json(
      { error: "Hardware hub is not configured on this server." },
      { status: 503 }
    );
  }
  const sub =
    isCognitoConfigured() ?
      await verifyBearerGetSub(req.headers.get("authorization"))
    : null;
  if (!sub) {
    return NextResponse.json({ starred: false });
  }
  const { id: projectId } = await ctx.params;
  if (!projectId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const meta = await getProjectMeta(projectId);
  if (!meta || !canViewProject(meta, sub)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const starred = await isStarred(sub, projectId);
  return NextResponse.json({ starred });
}
