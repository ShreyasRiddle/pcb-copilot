export type ComponentType =
  | "resistor"
  | "capacitor_ceramic"
  | "capacitor_electrolytic"
  | "inductor"
  | "ic"
  | "pad";

export interface SceneComponent {
  id: string;
  type: ComponentType;
  value: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  reasoning?: string;
  partNumber?: string;
  price?: string;
  url?: string;
  inStock?: boolean;
  distributor?: string;
  package?: string;
}

export interface BOMItem {
  component: string;
  value: string;
  unit: string;
  package: string;
  quantity: number;
  partNumber?: string;
  price?: string;
  url?: string;
  inStock?: boolean;
}

export interface PipelineStatus {
  stage: string;
  message: string;
  done: boolean;
}

export interface AssemblyStep {
  stepNumber: number;
  instruction: string;
  componentId: string;
}
