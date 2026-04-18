import { NextRequest, NextResponse } from "next/server";
import { WiringGraph } from "@/lib/types";

/**
 * POST /api/export-bom
 * Body: { wiringGraph: WiringGraph }
 * Returns: CSV file with all BOM components and sourcing data
 */
export async function POST(req: NextRequest) {
  let wiringGraph: WiringGraph;

  try {
    const body = await req.json();
    wiringGraph = body.wiringGraph as WiringGraph;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!wiringGraph?.nodes) {
    return NextResponse.json({ error: "Missing wiringGraph.nodes" }, { status: 400 });
  }

  const rows: string[] = [
    // Header row
    ["Ref", "Label", "Part Number", "Price", "Backordered", "Digikey URL"].join(","),
  ];

  for (const node of wiringGraph.nodes) {
    const bom = node.bom;
    rows.push(
      [
        csvCell(node.id),
        csvCell(node.label.replace(/\n/g, " ")),
        csvCell(bom?.partNumber ?? ""),
        csvCell(bom?.price ?? ""),
        csvCell(bom?.backordered ? "YES" : "no"),
        csvCell(bom?.url ?? ""),
      ].join(",")
    );
  }

  const csv = rows.join("\r\n") + "\r\n";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bom.csv"',
    },
  });
}

function csvCell(value: string): string {
  // Wrap in double quotes and escape any internal double quotes
  return `"${value.replace(/"/g, '""')}"`;
}
