import { NextRequest, NextResponse } from "next/server";
import { verifyBearerGetSub, isCognitoConfigured } from "@/lib/cognitoVerify";
import { listProjectComments, putProjectComment } from "@/lib/dynamoHardwareComments";
import { getProjectMeta } from "@/lib/dynamoHardware";
import { hardwareJsonResponse } from "@/lib/hardwareDevError";
import { hardwareReadReady } from "@/lib/hardwareGate";
import { canViewProject } from "@/lib/hardwareAccess";

const MAX_BODY = 4000;

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
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const sub = await verifyBearerGetSub(req.headers.get("authorization"));
  const meta = await getProjectMeta(id);
  if (!meta) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canViewProject(meta, sub)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const comments = await listProjectComments(id);
    return NextResponse.json({ comments });
  } catch (e) {
    console.error("listProjectComments", e);
    return hardwareJsonResponse(500, "Failed to load comments", e);
  }
}

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

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const meta = await getProjectMeta(id);
  if (!meta) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canViewProject(meta, sub)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text.length) {
    return NextResponse.json({ error: "Comment text is required." }, { status: 400 });
  }
  if (text.length > MAX_BODY) {
    return NextResponse.json(
      { error: `Comment must be at most ${MAX_BODY} characters.` },
      { status: 400 }
    );
  }

  try {
    const comment = await putProjectComment({
      projectId: id,
      authorSub: sub,
      body: text,
    });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (e) {
    console.error("putProjectComment", e);
    return hardwareJsonResponse(500, "Failed to post comment", e);
  }
}
