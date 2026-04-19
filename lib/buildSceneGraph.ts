import { SceneComponent } from "./types";

/**
 * Maps a BOM list to 3D positions on a virtual PCB grid.
 * Handles any component IDs — not just TPS563201 specific ones.
 */

// Role-based position slots: IC in center, grouped by function
const ROLE_GRID: Record<string, [number, number, number][]> = {
  ic:                    [[0, 0, 0]],
  inductor:              [[2.8, 0, 0], [4.2, 0, 0]],
  resistor:              [[-3.5, 0, 1.2], [-3.5, 0, -1.2], [-5, 0, 0], [-5, 0, 2]],
  capacitor_ceramic:     [[-2.2, 0, -3], [2.5, 0, -3], [0.8, 0, 2.5], [2.5, 0, 2.5], [-3.5, 0, -3]],
  capacitor_electrolytic:[[-2.2, 0, 3], [2.5, 0, 3]],
  pad:                   [[-6, 0, 0], [6, 0, 0]],
};

const OVERFLOW_GRID: [number, number, number][] = [
  [-1.5, 0, 4], [1.5, 0, 4], [-4, 0, -3.5], [4, 0, -3.5],
  [-5.5, 0, 2], [5.5, 0, 2], [-5.5, 0, -2], [5.5, 0, -2],
];

/**
 * Infer circuit traces from component types and topology.
 * Works for common switching regulator / linear reg patterns.
 */
export function buildTraces(components: SceneComponent[]): [string, string][] {
  const traces: [string, string][] = [];
  const byType = (t: string) => components.filter((c) => c.type === t);

  const ics = byType("ic");
  const inductors = byType("inductor");
  const resistors = byType("resistor");
  const ceramicCaps = byType("capacitor_ceramic");
  const electrolyticCaps = byType("capacitor_electrolytic");
  const allCaps = [...ceramicCaps, ...electrolyticCaps];

  // Split caps into likely input and output groups by position
  // (input caps tend to be at negative X, output caps at positive X)
  const inputCaps = allCaps.filter((c) => c.position[0] < 0);
  const outputCaps = allCaps.filter((c) => c.position[0] >= 0 && c.id !== ceramicCaps.find(cap => cap.id === c.id && c.position[2] > 1)?.id);
  const bootstrapCaps = ceramicCaps.filter((c) => c.position[2] > 1.5 && c.position[0] > 0);

  const ic = ics[0];
  const inductor = inductors[0];

  if (!ic) return traces;

  // IC → inductor (switch node)
  if (inductor) traces.push([ic.id, inductor.id]);

  // Inductor → output caps
  outputCaps.forEach((cap) => {
    if (inductor) traces.push([inductor.id, cap.id]);
  });

  // Input caps → IC
  inputCaps.forEach((cap) => traces.push([cap.id, ic.id]));

  // Bootstrap cap → IC
  bootstrapCaps.forEach((cap) => traces.push([ic.id, cap.id]));

  // Feedback resistors chain: IC → R1 → R2
  if (resistors.length >= 2) {
    traces.push([ic.id, resistors[0].id]);
    traces.push([resistors[0].id, resistors[1].id]);
    // R2 → output node (first output cap)
    if (outputCaps.length > 0) traces.push([resistors[1].id, outputCaps[0].id]);
  } else if (resistors.length === 1) {
    traces.push([ic.id, resistors[0].id]);
  }

  // Extra inductors
  inductors.slice(1).forEach((l) => {
    if (ic) traces.push([ic.id, l.id]);
  });

  return traces;
}

export function buildSceneGraph(bom: Partial<SceneComponent>[]): SceneComponent[] {
  // Track used slots per type
  const usedSlots: Record<string, number> = {};
  let overflowIdx = 0;

  const getPosition = (type: string): [number, number, number] => {
    const slots = ROLE_GRID[type] ?? [];
    const used = usedSlots[type] ?? 0;
    usedSlots[type] = used + 1;

    if (used < slots.length) return slots[used];
    // Overflow: place beyond the main grid
    return OVERFLOW_GRID[overflowIdx++ % OVERFLOW_GRID.length];
  };

  const components = bom.map((item, i): SceneComponent => {
    const type = (item.type as SceneComponent["type"]) ?? "resistor";
    const id = item.id || `C${i}`;

    return {
      id,
      type,
      value: item.value ?? "?",
      position: getPosition(type),
      rotation: [0, 0, 0] as [number, number, number],
      reasoning: item.reasoning,
      partNumber: item.partNumber,
      price: item.price,
      url: item.url,
      inStock: item.inStock,
      distributor: item.distributor,
      package: item.package,
    };
  });

  return components;
}
