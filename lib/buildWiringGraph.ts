/**
 * Generic WiringGraph builder.
 *
 * Accepts:
 *  - An enriched BOM array (components with sourcing data)
 *  - An AI-generated connections array (netlist)
 *
 * Performs:
 *  1. Automatic column-based layout (no hardcoded positions)
 *  2. Net-name → color mapping via regex patterns
 *  3. Falls back gracefully when connections are missing
 */

import { ComponentNode, ConnectionEdge, WiringGraph } from "./types";
import type { AIConnection } from "./pipeline";

// ── Net-name → wire color ─────────────────────────────────────────────────────

const NET_PATTERNS: Array<[RegExp, string]> = [
  [/VIN|VCC|V\+|\+\d+V|VSUP|VS\b/i,     "#ef4444"], // red    — power input
  [/GND|PGND|AGND|GND\d*/i,              "#6b7280"], // gray   — ground
  [/VOUT|OUT\b|VBAT|VREG/i,             "#22c55e"], // green  — output rail
  [/SW\b|SWITCH/i,                       "#f97316"], // orange — switching node
  [/FB|FEEDBACK|SENSE/i,                 "#3b82f6"], // blue   — feedback
  [/BOOT/i,                              "#a855f7"], // purple — bootstrap
  [/EN\b|ENABLE|SHDN/i,                  "#06b6d4"], // cyan   — enable/shutdown
  [/PWM|CTRL|PHASE/i,                    "#ec4899"], // pink   — control
  [/IN_A|IN_B|IN1|IN2|DIR/i,             "#f59e0b"], // amber  — motor direction inputs
  [/OUT_A|OUT_B|OUT1|OUT2|MOTOR/i,       "#10b981"], // emerald — motor outputs
];

const COLOR_PALETTE = [
  "#fbbf24", "#34d399", "#818cf8", "#f87171",
  "#a3e635", "#38bdf8", "#fb923c", "#c084fc",
];

function netColor(netName: string, fallbackIndex: number): string {
  for (const [re, color] of NET_PATTERNS) {
    if (re.test(netName)) return color;
  }
  return COLOR_PALETTE[fallbackIndex % COLOR_PALETTE.length];
}

// ── Auto-layout algorithm ─────────────────────────────────────────────────────

/**
 * Column assignment heuristic:
 *   col 0 (x=100)  — Input power passives (caps/resistors connected to IC power pins)
 *   col 1 (x=340)  — ICs (type="ic")
 *   col 2 (x=580)  — Mid passives (inductors, switching-node caps)
 *   col 3 (x=820)  — Output passives (output caps, load-side components)
 *   col 4 (x=1060) — Feedback / control passives (resistors, small caps)
 *
 * Canvas target: ~1200 × 560
 */

const COL_X = [100, 340, 580, 820, 1060];
const ROW_START_Y = 110;
const ROW_SPACING = 140;

type ColIndex = 0 | 1 | 2 | 3 | 4;

interface EnrichedBOMItem {
  id: string;
  type: string;
  label?: string;
  value: string;
  reasoning?: string;
  partNumber?: string;
  price?: string;
  url?: string;
  distributor?: string;
  inStock?: boolean;
  backordered?: boolean;
}

function assignColumns(
  bom: EnrichedBOMItem[],
  connections: AIConnection[]
): Map<string, ColIndex> {
  const colMap = new Map<string, ColIndex>();

  // Step 1 — ICs always go in column 1
  for (const item of bom) {
    if (item.type === "ic") {
      colMap.set(item.id, 1);
    }
  }

  // Build adjacency: for each node, what nodes does it connect to?
  const adjacency = new Map<string, Set<string>>();
  for (const c of connections) {
    if (!adjacency.has(c.from)) adjacency.set(c.from, new Set());
    if (!adjacency.has(c.to))   adjacency.set(c.to,   new Set());
    adjacency.get(c.from)!.add(c.to);
    adjacency.get(c.to)!.add(c.from);
  }

  const icIds = new Set(bom.filter((b) => b.type === "ic").map((b) => b.id));

  // Step 2 — classify remaining components by what they connect to
  for (const item of bom) {
    if (colMap.has(item.id)) continue;
    const neighbors = adjacency.get(item.id) ?? new Set<string>();

    const connectedToIC = [...neighbors].some((n) => icIds.has(n));
    const hasICNeighbors = connectedToIC;

    // Inductors → column 2 (switching node side)
    if (item.type === "inductor") {
      colMap.set(item.id, 2);
      continue;
    }

    // Diodes → column 2
    if (item.type === "diode" || item.type === "mosfet") {
      colMap.set(item.id, 2);
      continue;
    }

    if (hasICNeighbors) {
      // Determine which side of the IC based on net names of connected edges
      const connectedNets = connections
        .filter(
          (c) =>
            (c.from === item.id || c.to === item.id) &&
            (icIds.has(c.from) || icIds.has(c.to))
        )
        .map((c) => c.net.toUpperCase());

      // Power-input-related nets → left of IC (col 0)
      const isPowerInput = connectedNets.some((n) =>
        /VIN|VCC|V\+|VSUP|VS\b/i.test(n)
      );
      // Output-related nets → right of IC (col 3)
      const isOutput = connectedNets.some((n) =>
        /VOUT|OUT|MOTOR|LOAD|DRAIN/i.test(n)
      );

      if (isPowerInput) {
        colMap.set(item.id, 0);
      } else if (isOutput) {
        colMap.set(item.id, 3);
      } else {
        // Default passives beside IC → col 2 (between IC and output)
        colMap.set(item.id, 2);
      }
      continue;
    }

    // Components not directly connected to an IC
    // Check if they're connected to col-2 components (output side)
    const connectedToCol2 = [...neighbors].some((n) => colMap.get(n) === 2);
    if (connectedToCol2) {
      colMap.set(item.id, 3);
      continue;
    }

    // Feedback resistors / small caps often connect to col-3 output side → col 4
    const connectedToCol3 = [...neighbors].some((n) => colMap.get(n) === 3);
    if (
      connectedToCol3 &&
      (item.type === "resistor" || item.type === "capacitor_ceramic")
    ) {
      colMap.set(item.id, 4);
      continue;
    }

    // Unclassified — put beside IC
    colMap.set(item.id, 2);
  }

  return colMap;
}

function computePositions(
  bom: EnrichedBOMItem[],
  colMap: Map<string, ColIndex>
): Map<string, { x: number; y: number }> {
  // Group components by column
  const cols: Map<ColIndex, string[]> = new Map();
  for (let c = 0; c <= 4; c++) cols.set(c as ColIndex, []);

  for (const item of bom) {
    const col = colMap.get(item.id) ?? 2;
    cols.get(col as ColIndex)!.push(item.id);
  }

  const posMap = new Map<string, { x: number; y: number }>();

  for (const [col, ids] of cols.entries()) {
    if (ids.length === 0) continue;
    const x = COL_X[col];
    const totalHeight = (ids.length - 1) * ROW_SPACING;
    const startY = ROW_START_Y + Math.max(0, (400 - totalHeight) / 2);
    ids.forEach((id, i) => {
      posMap.set(id, { x, y: startY + i * ROW_SPACING });
    });
  }

  return posMap;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildWiringGraph(
  bom: EnrichedBOMItem[],
  aiConnections: AIConnection[] = []
): WiringGraph {
  // Determine layout
  const colMap = assignColumns(bom, aiConnections);
  const posMap = computePositions(bom, colMap);

  // Build node set
  const nodeIds = new Set(bom.map((b) => b.id));

  const nodes: ComponentNode[] = bom.map((item) => {
    const pos = posMap.get(item.id) ?? { x: 100, y: 300 };
    const label = item.label ?? item.id;
    return {
      id: item.id,
      label,
      x: pos.x,
      y: pos.y,
      reasoning: item.reasoning || undefined,
      bom: item.partNumber && item.partNumber !== "N/A"
        ? {
            partNumber: item.partNumber,
            price: item.price ?? "N/A",
            url: item.url ?? "",
            distributor: item.distributor,
            backordered: item.inStock === false || item.backordered === true,
          }
        : undefined,
    };
  });

  // Track unique net colors
  const netColorCache = new Map<string, string>();
  let netColorIdx = 0;
  function colorForNet(net: string): string {
    if (!netColorCache.has(net)) {
      netColorCache.set(net, netColor(net, netColorIdx++));
    }
    return netColorCache.get(net)!;
  }

  // Build edges from AI connections, filtering to known nodes only
  const bomById = Object.fromEntries(bom.map((b) => [b.id, b]));

  let edges: ConnectionEdge[];

  if (aiConnections.length > 0) {
    edges = aiConnections
      .filter((c) => nodeIds.has(c.from) && nodeIds.has(c.to))
      .map((c, i): ConnectionEdge => {
        const fromItem = bomById[c.from];
        const toItem = bomById[c.to];
        const backordered =
          fromItem?.inStock === false ||
          toItem?.inStock === false ||
          fromItem?.backordered === true ||
          toItem?.backordered === true;

        return {
          id: `edge-${i}`,
          code: c.code || String.fromCharCode(65 + (i % 26)),
          label: c.label || c.net,
          from: c.from,
          fromPin: c.fromPin,
          to: c.to,
          toPin: c.toPin,
          color: colorForNet(c.net || c.label),
          awg: c.awg ?? 24,
          lengthCm: estimateLength(posMap.get(c.from), posMap.get(c.to)),
          backordered,
        };
      });
  } else {
    // No AI connections provided — no edges (diagram shows nodes only)
    edges = [];
  }

  return { nodes, edges };
}

/** Rough length estimate based on Manhattan distance in SVG units → cm */
function estimateLength(
  a: { x: number; y: number } | undefined,
  b: { x: number; y: number } | undefined
): number {
  if (!a || !b) return 10;
  const dist = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  // SVG canvas ~1200 wide ≈ 30cm real, so 1 SVG unit ≈ 0.025cm
  return Math.max(2, Math.round(dist * 0.025));
}
