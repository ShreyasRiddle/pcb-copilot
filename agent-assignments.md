# Agent Assignments — PCB Copilot

Two developers. Clean split along the AI backend / 2D frontend boundary.
The only shared surface is `lib/types.ts` — agree on `WiringGraph` shape before coding begins.

---

## Person 1 — AI Pipeline & Backend

### Owns These Files
| File | Responsibility |
|------|---------------|
| `lib/pipeline.ts` | Orchestrate the four Claude steps end-to-end |
| `lib/buildWiringGraph.ts` | Deterministic algorithm: enriched BOM → `WiringGraph` JSON |
| `app/api/design/route.ts` | SSE route — emit status, result, error events |
| `hooks/useCircuitPipeline.ts` | SSE client hook (parsing side only) |
| `lib/types.ts` | Owns the canonical type definitions (coordinate with P2) |

### Phase 2 Tasks
- [ ] Wire Steps 1–4 in `lib/pipeline.ts` into a single request that returns a valid `WiringGraph`
- [ ] Implement `lib/buildWiringGraph.ts`:
  - Assign (x, y) positions to component blocks using hierarchical left-to-right layout
  - Map each BOM connection to a `ConnectionEdge` with `fromPin`, `toPin`, `color`, `awg`, `lengthCm`
  - Assign colors by signal type (power = red, ground = black, signal = blue/green/purple/white)
- [ ] SSE streaming in `app/api/design/route.ts`:
  - `{ type: "status", step: 1 | 2 | 3 | 4, message: string }` after each step
  - `{ type: "result", data: WiringGraph }` on success
  - `{ type: "error", message: string }` on failure
- [ ] Step 3 (parts sourcer): ensure every `ConnectionEdge` that maps to a BOM item gets `partNumber`, `price`, `url`
- [ ] Flag backordered items with `backordered: true` on the edge — never drop them

### Phase 3 Tasks
- [ ] `/api/export-bom` route — serialize `WiringGraph.nodes` BOM data to CSV

### Phase 4 Tasks
- [ ] Vercel environment variable setup (`ANTHROPIC_API_KEY`, etc.)
- [ ] Edge function compatibility audit — ensure no Node-only APIs in route handlers
- [ ] Update `.env.example` with all required keys

### Contract Delivered to Person 2
```ts
// lib/types.ts — finalize with P2 before implementation
type WiringGraph = {
  nodes: ComponentNode[]
  edges: ConnectionEdge[]
}

type ComponentNode = {
  id: string
  label: string
  x: number        // SVG canvas coordinate
  y: number        // SVG canvas coordinate
  bom?: {
    partNumber: string
    price: number
    url: string
    backordered?: boolean
  }
}

type ConnectionEdge = {
  id: string
  code: string        // e.g. "E", "F", "H", "N"
  label: string       // e.g. "5V_Logic", "GND_Logic"
  from: string        // node id
  fromPin: string     // e.g. "P15"
  to: string          // node id
  toPin: string       // e.g. "P16"
  color: string       // CSS color string, e.g. "#ef4444"
  awg: number         // e.g. 20, 24
  lengthCm: number    // e.g. 12, 18
  backordered?: boolean
}
```

---

## Person 2 — 2D Wiring Diagram & UI

### Owns These Files
| File | Responsibility |
|------|---------------|
| `components/WiringDiagram.tsx` *(new)* | Full-viewport SVG wiring diagram |
| `components/ConnectionTable.tsx` *(new)* | Hover-linked connection table |
| `components/SourcingPanel.tsx` | Right-rail sourcing detail panel |
| `components/InputDrawer.tsx` | User input form (IC + specs) |
| `components/StatusBar.tsx` | Live pipeline step status |
| `app/page.tsx` | Page layout + SSE hook wiring |
| `lib/demoWiring.ts` *(new)* | Hardcoded `WiringGraph` fixture for development |

### Phase 2 Tasks

#### `lib/demoWiring.ts` — development fixture
- [ ] Create a hardcoded `WiringGraph` matching the TPS563201 demo circuit
- [ ] Use it in the hook until P1's pipeline is stable — swap is one line

#### `components/WiringDiagram.tsx` — SVG canvas
- [ ] Render `ComponentNode` blocks as dark rounded-rect (`rx=8`) `<rect>` with centered white label text
- [ ] Render `ConnectionEdge` paths as cubic-bezier `<path>` elements:
  - Stroke color = `edge.color`
  - Control points: exit horizontally from source block, enter horizontally into target block
- [ ] Render pin dots (filled circle, ~4px radius) + pin label text at each wire endpoint
- [ ] **Hover a component block:**
  - Set `hoveredNodeId` state
  - Dim all edges not connected to this node → `opacity: 0.15`
  - Highlight connected edges → `opacity: 1.0`, stroke-width × 1.5, CSS `drop-shadow` filter in edge color
  - Show `<ConnectionTable>` filtered to this node's edges
- [ ] **Blur component block:** restore all edge opacity to 1.0, hide table
- [ ] ViewBox auto-scales to fit all node positions with 40px padding

#### `components/ConnectionTable.tsx` — connection table
- [ ] Columns: Code | Label | From | To | AWG | Color | Len
- [ ] Color column: small filled circle in `edge.color`
- [ ] **Hover a table row:**
  - Emit `onEdgeHighlight(edgeId)` callback to parent
  - Parent sets `highlightedEdgeId` state in `WiringDiagram`
  - Highlighted path gets `stroke-width × 2` + `filter: drop-shadow(0 0 6px <edge.color>)`
- [ ] **Mouse-out row:** emit `onEdgeHighlight(null)`, restore path to default style

#### `components/StatusBar.tsx`
- [ ] Consume SSE `status` events; display step label:
  - Step 1 → "Parsing datasheet…"
  - Step 2 → "Calculating component values…"
  - Step 3 → "Sourcing parts from Digikey…"
  - Step 4 → "Building wiring diagram…"
- [ ] Animate between steps with a progress indicator

#### `app/page.tsx`
- [ ] Connect `useCircuitPipeline` hook; pass `WiringGraph` to `<WiringDiagram>`
- [ ] Swap `demoWiring.ts` fixture for live data once P1's pipeline is confirmed working

### Phase 3 Tasks
- [ ] **Sourcing panel** (`SourcingPanel.tsx`): slide in from right on component/edge click
  - Show part number, price, stock level, buy button (Digikey URL from `node.bom.url`)
  - Backordered badge if `backordered: true`
- [ ] **BOM panel**: full component table with CSV download button
  - Fetch CSV from `/api/export-bom` (P1's route)
- [ ] **Backordered visual treatment**:
  - Render backordered edges as dashed strokes (`stroke-dasharray`)
  - Amber color override regardless of signal type
  - Small warning badge on the connected component block

### Phase 4 Tasks
- [ ] `npm run build` smoke test — fix any SSR issues (SVG is safe, but check Framer Motion imports)
- [ ] `README.md` demo GIF — record a screen capture of the hover interaction

---

## Coordination Checklist

Before either person writes code that crosses the boundary:

- [ ] **Agree on `WiringGraph` type shape** in `lib/types.ts` — lock it before week 1 coding starts
- [ ] **Agree on `color` field format** — use 6-digit hex (`#rrggbb`) everywhere
- [ ] **Agree on SSE event shapes** — `status`, `result`, `error` payloads
- [ ] **Integration test** (week 4) — run full pipeline with TPS563201 PDF, verify every edge in the diagram matches the BOM connections

---

## Visual Reference

The target wiring diagram UI:

- Dark background (`#1a1a1a`)
- Component blocks: `#2a2a2a` fill, `1px #444` border, white label, `8px` border-radius
- Wires: 2px stroke at rest, 3px on component hover, 4px on row hover; each signal type has a distinct color
- Pin dots: 4px filled circle in `#888`, pin label in `11px` monospace above/below
- Connection table: same dark background, `12px` sans-serif, color swatch dot in Color column
- Hover transitions: 150ms ease on opacity and stroke-width
