import { NextResponse } from "next/server";
import { hardwareDiagnosticsEndpointEnabled } from "@/lib/hardwareDevError";
import { runHardwareDiagnosticsReport } from "@/lib/hardwareDiagnostics";

/**
 * Development / explicit-flag only. Surfaces env presence and live Dynamo/S3 checks.
 * Set ENABLE_HARDWARE_DIAGNOSTICS=1 to enable outside NODE_ENV=development.
 */
export async function GET() {
  if (!hardwareDiagnosticsEndpointEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const report = await runHardwareDiagnosticsReport();
    return NextResponse.json(report);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Diagnostics failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
