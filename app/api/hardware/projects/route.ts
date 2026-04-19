import { NextRequest, NextResponse } from "next/server";
import { verifyBearerGetSub, isCognitoConfigured } from "@/lib/cognitoVerify";
import { createProject, listOwnerProjects, listPublicProjects } from "@/lib/dynamoHardware";
import { hardwareJsonResponse } from "@/lib/hardwareDevError";
import { hardwareReadReady } from "@/lib/hardwareGate";
import type { HardwareVisibility } from "@/lib/hardwareTypes";

export async function GET(req: NextRequest) {
  if (!hardwareReadReady()) {
    return NextResponse.json(
      { error: "Hardware hub is not configured on this server." },
      { status: 503 }
    );
  }

  const scope = req.nextUrl.searchParams.get("scope") ?? "public";
  const sub = await verifyBearerGetSub(req.headers.get("authorization"));

  try {
    if (scope === "mine") {
      if (!isCognitoConfigured()) {
        return NextResponse.json(
          { error: "Sign-in is not configured on this server." },
          { status: 503 }
        );
      }
      if (!sub) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const projects = await listOwnerProjects(sub);
      return NextResponse.json({ projects });
    }
    const projects = await listPublicProjects(50);
    return NextResponse.json({ projects });
  } catch (e) {
    console.error("list hardware projects", e);
    return hardwareJsonResponse(500, "Failed to list projects", e);
  }
}

export async function POST(req: NextRequest) {
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

  let body: {
    title?: string;
    description?: string;
    licenseSpdx?: string;
    visibility?: HardwareVisibility;
    readmeMarkdown?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const visibility = body.visibility ?? "private";
  if (visibility === "public" && !body.licenseSpdx?.trim()) {
    return NextResponse.json(
      { error: "License (SPDX) is required for public projects." },
      { status: 400 }
    );
  }

  try {
    const project = await createProject({
      ownerSub: sub,
      title: body.title?.trim() || "Untitled",
      description: body.description ?? "",
      licenseSpdx: body.licenseSpdx?.trim() || "CC-BY-4.0",
      visibility,
      readmeMarkdown: body.readmeMarkdown,
    });
    return NextResponse.json(
      {
        id: project.projectId,
        title: project.title,
        visibility: project.visibility,
        createdAt: project.createdAt,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("create hardware project", e);
    return hardwareJsonResponse(500, "Failed to create project", e);
  }
}
