// ── Legacy 3D types (kept for reference during transition) ─────────────────
export type ComponentType =
  | "resistor"
  | "capacitor_ceramic"
  | "capacitor_electrolytic"
  | "inductor"
  | "ic"
  | "diode"
  | "mosfet"
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

// ── 2D Wiring Graph types ───────────────────────────────────────────────────

export interface ComponentNode {
  id: string;
  label: string;
  x: number;
  y: number;
  bom?: {
    partNumber: string;
    price: string;
    url: string;
    distributor?: string;
    backordered?: boolean;
  };
}

export interface ConnectionEdge {
  id: string;
  /** Short alphabetic code shown in the connection table (A, B, C…) */
  code: string;
  /** Human-readable net name (VIN, GND, SW, VOUT, FB, BOOT) */
  label: string;
  from: string;
  fromPin: string;
  to: string;
  toPin: string;
  /** CSS hex color string, e.g. "#ef4444" */
  color: string;
  /** Wire gauge — for PCB traces this represents min trace width in mils */
  awg: number;
  /** Estimated trace/wire length in cm */
  lengthCm: number;
  backordered?: boolean;
}

export interface WiringGraph {
  nodes: ComponentNode[];
  edges: ConnectionEdge[];
}

// ── SSE event types ──────────────────────────────────────────────────────────

export type StatusEvent = {
  type: "status";
  step: 1 | 2 | 3 | 4;
  message: string;
};

export type ResultEvent = {
  type: "result";
  data: WiringGraph;
};

export type ErrorEvent = {
  type: "error";
  message: string;
};

/** A single clarification question the AI needs answered before proceeding */
export type ClarificationQuestion = {
  id: string;
  text: string;
  /** When present, render as chip buttons; otherwise render as free-text input */
  options?: string[];
};

/** Emitted when the AI determines the prompt is too vague to proceed */
export type QuestionEvent = {
  type: "question";
  questions: ClarificationQuestion[];
};

export type SSEEvent =
  | StatusEvent
  | ResultEvent
  | ErrorEvent
  | QuestionEvent;
