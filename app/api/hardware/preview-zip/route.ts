import { NextRequest, NextResponse } from "next/server";
import { verifyBearerGetSub, isCognitoConfigured } from "@/lib/cognitoVerify";
import { previewHardwareZipBuffer } from "@/lib/hardwareFinalize";
import { hardwareJsonResponse } from "@/lib/hardwareDevError";

const MAX_ZIP_BYTES = 50 * 1024 * 1024;

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (!isCognitoConfigured()) {
    return NextResponse.json(
      { error: "Sign-in is not configured on this server." },
      { status: 503 }
    );
  }
  if (!(await verifyBearerGetSub(req.headers.get("authorization")))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_ZIP_BYTES) {
    return NextResponse.json(
      { error: `Zip must be between 1 byte and ${MAX_ZIP_BYTES / (1024 * 1024)} MB.` },
      { status: 400 }
    );
  }

  const name = "name" in file && typeof file.name === "string" ? file.name : "";
  if (!name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ error: "File must be a .zip" }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await previewHardwareZipBuffer(buf);
    return NextResponse.json(result);
  } catch (e) {
    console.error("preview zip", e);
    return hardwareJsonResponse(400, "Could not read zip", e);
  }
}
