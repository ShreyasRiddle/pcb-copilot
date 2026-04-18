import { SceneComponent } from "./types";

/**
 * Maps a flat BOM list to a 3D scene grid layout.
 * No AI involved — pure algorithmic placement.
 */
export function buildSceneGraph(bom: Partial<SceneComponent>[]): SceneComponent[] {
  // Grid positions: IC in center, passives arranged around it
  const positions: Record<string, [number, number, number]> = {
    U1: [0, 0, 0],
    R1: [-3.5, 0, 1.2],
    R2: [-3.5, 0, -1.2],
    L1: [2.8, 0, 0],
    Cin: [-2.2, 0, -3],
    Cout: [2.5, 0, -3],
    Cboot: [0.8, 0, 2.5],
  };

  // Default positions for any extra components not in the map
  const fallbackGrid: [number, number, number][] = [
    [-1.5, 0, 3],
    [1.5, 0, 3],
    [-4, 0, 0],
    [4, 0, 0],
    [-4, 0, 3],
    [4, 0, 3],
  ];
  let fallbackIdx = 0;

  return bom.map((item, i) => {
    const id = item.id || `C${i}`;
    const pos = positions[id] ?? fallbackGrid[fallbackIdx++] ?? [i * 2 - 4, 0, 4];

    return {
      id,
      type: (item.type as SceneComponent["type"]) ?? "resistor",
      value: item.value ?? "?",
      position: pos,
      rotation: [0, 0, 0],
      reasoning: item.reasoning,
      partNumber: item.partNumber,
      price: item.price,
      url: item.url,
      inStock: item.inStock,
      distributor: item.distributor,
      package: item.package,
    };
  });
}
