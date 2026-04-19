import { NextRequest, NextResponse } from "next/server";
import { verifyBearerGetSub, isCognitoConfigured } from "@/lib/cognitoVerify";
import { getDesign, deleteDesign } from "@/lib/dynamoDesigns";
import { SAVED_DESIGNS_503_MESSAGE } from "@/lib/savedDesignsConstants";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isCognitoConfigured() || !process.env.DESIGNS_TABLE_NAME) {
    return NextResponse.json({ error: SAVED_DESIGNS_503_MESSAGE }, { status: 503 });
  }
  const sub = await verifyBearerGetSub(req.headers.get("authorization"));
  if (!sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const design = await getDesign(sub, id);
    if (!design) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: design.designId,
      title: design.title,
      prompt: design.prompt,
      wiringGraph: design.wiringGraph,
      createdAt: design.createdAt,
      updatedAt: design.updatedAt,
    });
  } catch (e) {
    console.error("getDesign", e);
    return NextResponse.json(
      { error: "Failed to load design" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isCognitoConfigured() || !process.env.DESIGNS_TABLE_NAME) {
    return NextResponse.json({ error: SAVED_DESIGNS_503_MESSAGE }, { status: 503 });
  }
  const sub = await verifyBearerGetSub(req.headers.get("authorization"));
  if (!sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    await deleteDesign(sub, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("deleteDesign", e);
    return NextResponse.json(
      { error: "Failed to delete design" },
      { status: 500 }
    );
  }
}
