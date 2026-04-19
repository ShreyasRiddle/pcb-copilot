import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { verifyBearerGetSub, isCognitoConfigured } from "@/lib/cognitoVerify";
import { createProject, putRevision } from "@/lib/dynamoHardware";
import { hardwareHubReady } from "@/lib/hardwareGate";
import { hardwareJsonResponse } from "@/lib/hardwareDevError";
import type { WiringGraph } from "@/lib/types";
import { putObjectText, skidlPyKey } from "@/lib/s3Hardware";

export const maxDuration = 120;

/**
 * Publish a single SKiDL .py file + wiring graph directly to Hardware Hub.
 * This bypasses the zip upload/finalize workflow.
 */
export async function POST(req: NextRequest) {
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

  let body: {
    title?: string;
    description?: string;
    readmeMarkdown?: string;
    licenseSpdx?: string;
    visibility?: "public" | "unlisted" | "private";
    wiringGraph?: WiringGraph;
    skidlPy?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.wiringGraph?.nodes?.length) {
    return NextResponse.json({ error: "Missing wiringGraph" }, { status: 400 });
  }
  if (!body.skidlPy || !body.skidlPy.trim()) {
    return NextResponse.json({ error: "Missing skidlPy" }, { status: 400 });
  }

  try {
    const project = await createProject({
      ownerSub: sub,
      title: body.title?.trim() || "Untitled",
      description: body.description ?? "",
      licenseSpdx: body.licenseSpdx?.trim() || "MIT",
      visibility: body.visibility ?? "private",
      readmeMarkdown: body.readmeMarkdown ?? "",
    });

    const revisionId = randomUUID();
    const key = skidlPyKey(sub, project.projectId, revisionId);
    const bytes = Buffer.from(body.skidlPy, "utf8");
    const sha256 = createHash("sha256").update(bytes).digest("hex");

    await putObjectText(key, body.skidlPy, "text/x-python");

    await putRevision({
      projectId: project.projectId,
      ownerSub: sub,
      revisionId,
      sourceKind: "skidl_py",
      sourceFilename: "circuit_skidl.py",
      s3Key: key,
      sizeBytes: bytes.length,
      sha256,
      fileManifest: ["circuit_skidl.py"],
      bomRaw: [],
      pcbStats: null,
      bomEnriched: null,
      wiringGraph: body.wiringGraph,
      analysisStatus: "complete",
    });

    return NextResponse.json({ projectId: project.projectId, revisionId }, { status: 201 });
  } catch (e) {
    console.error("publish skidl", e);
    return hardwareJsonResponse(500, "Failed to publish", e);
  }
}

