import { NextRequest, NextResponse } from "next/server";
import { verifyBearerGetSub, isCognitoConfigured } from "@/lib/cognitoVerify";
import {
  getProjectMeta,
  getLatestRevision,
  isStarred,
  updateProjectFields,
  updateProjectVisibility,
} from "@/lib/dynamoHardware";
import { hardwareJsonResponse } from "@/lib/hardwareDevError";
import { hardwareReadReady } from "@/lib/hardwareGate";
import { canViewProject, canEditProject } from "@/lib/hardwareAccess";
import type { HardwareVisibility } from "@/lib/hardwareTypes";

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

  const rev = await getLatestRevision(id);
  return NextResponse.json({
    project: meta,
    revision: rev,
    starred: sub ? await isStarred(sub, id) : false,
  });
}

export async function PATCH(
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
  if (!meta || !canEditProject(meta, sub)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    title?: string;
    description?: string;
    licenseSpdx?: string;
    readmeMarkdown?: string;
    visibility?: HardwareVisibility;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.visibility === "public" && meta.visibility !== "public") {
    const lic = body.licenseSpdx ?? meta.licenseSpdx;
    if (!lic?.trim()) {
      return NextResponse.json(
        { error: "License (SPDX) is required for public projects." },
        { status: 400 }
      );
    }
  }

  try {
    if (body.visibility !== undefined && body.visibility !== meta.visibility) {
      await updateProjectVisibility(id, sub, body.visibility);
    }
    const hasFieldUpdates =
      body.title !== undefined ||
      body.description !== undefined ||
      body.licenseSpdx !== undefined ||
      body.readmeMarkdown !== undefined;
    if (hasFieldUpdates) {
      await updateProjectFields(id, sub, {
        title: body.title,
        description: body.description,
        licenseSpdx: body.licenseSpdx,
        readmeMarkdown: body.readmeMarkdown,
      });
    }
    const updated = await getProjectMeta(id);
    return NextResponse.json({ project: updated });
  } catch (e) {
    console.error("patch hardware project", e);
    return hardwareJsonResponse(500, "Update failed", e);
  }
}
