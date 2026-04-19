import { NextRequest, NextResponse } from "next/server";
import { verifyBearerGetSub, isCognitoConfigured } from "@/lib/cognitoVerify";
import { createDesign, listDesigns } from "@/lib/dynamoDesigns";
import { SAVED_DESIGNS_503_MESSAGE } from "@/lib/savedDesignsConstants";
import type { WiringGraph } from "@/lib/types";

export async function GET(req: NextRequest) {
  if (!isCognitoConfigured() || !process.env.DESIGNS_TABLE_NAME) {
    return NextResponse.json({ error: SAVED_DESIGNS_503_MESSAGE }, { status: 503 });
  }
  const sub = await verifyBearerGetSub(req.headers.get("authorization"));
  if (!sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const designs = await listDesigns(sub);
    return NextResponse.json({ designs });
  } catch (e) {
    console.error("listDesigns", e);
    return NextResponse.json(
      { error: "Failed to list designs" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isCognitoConfigured() || !process.env.DESIGNS_TABLE_NAME) {
    return NextResponse.json({ error: SAVED_DESIGNS_503_MESSAGE }, { status: 503 });
  }
  const sub = await verifyBearerGetSub(req.headers.get("authorization"));
  if (!sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { title?: string; prompt?: string; wiringGraph?: WiringGraph; skidlPy?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.wiringGraph?.nodes) {
    return NextResponse.json(
      { error: "Missing wiringGraph" },
      { status: 400 }
    );
  }

  try {
    const saved = await createDesign(sub, {
      title: body.title?.trim() || "Untitled",
      prompt: body.prompt,
      wiringGraph: body.wiringGraph,
      skidlPy: typeof body.skidlPy === "string" ? body.skidlPy : undefined,
    });
    return NextResponse.json(
      {
        id: saved.designId,
        title: saved.title,
        createdAt: saved.createdAt,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("createDesign", e);
    return NextResponse.json(
      { error: "Failed to save design" },
      { status: 500 }
    );
  }
}
