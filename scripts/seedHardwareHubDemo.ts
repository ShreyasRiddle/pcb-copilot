/**
 * One-off Hardware Hub demo seed.
 *
 * Run:
 *   DEMO_OWNER_SUB=<cognito-sub> npx tsx scripts/seedHardwareHubDemo.ts
 *
 * Optional env:
 *   DEMO_TITLE="TPS563201 Demo Board"
 *   DEMO_VISIBILITY=public|unlisted|private   (default: unlisted)
 *   DEMO_LICENSE=MIT                           (default: MIT)
 */

import { randomUUID, createHash } from "crypto";
import { DEMO_WIRING } from "../lib/demoWiring";
import { createProject, listOwnerProjects, putRevision } from "../lib/dynamoHardware";
import type { HardwareVisibility, RawBomLine } from "../lib/hardwareTypes";
import { putObjectText, skidlPyKey } from "../lib/s3Hardware";

const DEMO_MARKER = "seed:hardware-demo:tps563201";

function parseVisibility(v: string | undefined): HardwareVisibility {
  if (v === "public" || v === "unlisted" || v === "private") return v;
  return "unlisted";
}

function bomFromDemoWiring(): RawBomLine[] {
  return DEMO_WIRING.nodes.map((n) => {
    const [refLine, valueLine] = n.label.split("\n");
    return {
      reference: (refLine || n.id).trim(),
      value: (valueLine || refLine || n.id).trim(),
      footprint: "Demo_Footprint",
      libSymbol: "Demo:TemplatePart",
      quantity: 1,
    };
  });
}

function buildDemoSkidlPy(title: string): string {
  return `# ${title}
# ${DEMO_MARKER}
# Dummy SKiDL source for Hardware Hub demo seeding.
from skidl import *

vin = Net("VIN")
gnd = Net("GND")
vout = Net("VOUT")
fb = Net("FB")

u1 = Part(tool=SKIDL, name="TPS563201", ref="U1",
          pins=[Pin(num=1, name="VIN", func=Pin.types.PWRIN),
                Pin(num=2, name="GND", func=Pin.types.PWROUT),
                Pin(num=3, name="SW",  func=Pin.types.OUTPUT),
                Pin(num=4, name="FB",  func=Pin.types.INPUT),
                Pin(num=5, name="BOOT",func=Pin.types.INPUT)])

cin = Part(tool=SKIDL, name="C", ref="Cin",
           pins=[Pin(num=1, name="P+", func=Pin.types.PASSIVE),
                 Pin(num=2, name="P-", func=Pin.types.PASSIVE)])
cin["P+"] += vin
cin["P-"] += gnd
u1["VIN"] += vin
u1["GND"] += gnd
u1["FB"] += fb

ERC()
generate_netlist()
`;
}

async function main() {
  const ownerSub = process.env.DEMO_OWNER_SUB?.trim();
  if (!ownerSub) {
    throw new Error("DEMO_OWNER_SUB is required.");
  }

  const title = process.env.DEMO_TITLE?.trim() || "TPS563201 Demo Power Board";
  const visibility = parseVisibility(process.env.DEMO_VISIBILITY?.trim());
  const licenseSpdx = process.env.DEMO_LICENSE?.trim() || "MIT";
  const readmeMarkdown = [
    "## Hardware Hub Demo Seed",
    "",
    `Marker: \`${DEMO_MARKER}\``,
    "",
    "This project is seeded for demo purposes with a hardcoded wiring graph and BOM.",
  ].join("\n");

  // Idempotency guard: if marker already exists for this owner, reuse and exit.
  const mine = await listOwnerProjects(ownerSub);
  const existing = mine.find(
    (p) =>
      p.title === title ||
      p.readmeMarkdown?.includes(DEMO_MARKER) ||
      p.description.includes(DEMO_MARKER)
  );
  if (existing) {
    console.log(`Demo project already exists: ${existing.projectId}`);
    console.log(`Open: /hardware/${existing.projectId}`);
    return;
  }

  const project = await createProject({
    ownerSub,
    title,
    description: `Demo fixture (${DEMO_MARKER})`,
    licenseSpdx,
    visibility,
    readmeMarkdown,
  });

  const revisionId = randomUUID();
  const py = buildDemoSkidlPy(title);
  const s3Key = skidlPyKey(ownerSub, project.projectId, revisionId);
  await putObjectText(s3Key, py, "text/x-python");

  const bytes = Buffer.from(py, "utf8");
  const sha = createHash("sha256").update(bytes).digest("hex");

  await putRevision({
    projectId: project.projectId,
    ownerSub,
    revisionId,
    sourceKind: "skidl_py",
    sourceFilename: "circuit_skidl.py",
    s3Key,
    sizeBytes: bytes.length,
    sha256: sha,
    fileManifest: ["README.md", "demo.kicad_sch", "demo.kicad_pcb", "circuit_skidl.py"],
    bomRaw: bomFromDemoWiring(),
    pcbStats: { copperLayers: 2, widthMm: 24, heightMm: 18 },
    bomEnriched: null,
    wiringGraph: DEMO_WIRING,
    analysisStatus: "complete",
    analysisError: "Demo seed: hardcoded wiring graph/BOM.",
  });

  console.log(`Created demo project: ${project.projectId}`);
  console.log(`Created demo revision: ${revisionId}`);
  console.log(`Open: /hardware/${project.projectId}`);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exitCode = 1;
});

