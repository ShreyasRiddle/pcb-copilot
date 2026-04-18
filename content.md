# PCB Copilot — Presentation Brief

---

## The Problem

Hardware engineering has a dirty secret: **the design loop is broken**.

An engineer sits down to design a simple power supply. Before writing a single line of schematic, they need to:

1. Find the right IC — sifting through hundreds of parts across TI, Infineon, Digikey
2. Download a 120-page datasheet and locate the application circuit buried on page 47
3. Extract design equations by hand — feedback dividers, inductor sizing, capacitor ESR calculations
4. Plug numbers into those equations, check against recommended ranges, iterate
5. Search Digikey or Mouser for each passive — filter by value, package, voltage rating, stock
6. Verify every part is actually available, not backordered for 40 weeks
7. Lay out the BOM, get prices, send to procurement
8. Then — finally — start placing components on a board

This loop takes **days to weeks** for an experienced engineer. For a student or first-time hardware builder, it's a wall they never get past.

The tools haven't changed. SPICE simulators from the 80s. PDF datasheets. Excel BOMs. The same Digikey search box from 2003.

**Hardware has a software problem.**

---

## Why Now

Three things converged in 2024–2025 that make this possible:

**1. Multimodal AI that can read datasheets natively**
Claude and GPT-4V can now ingest a PDF datasheet as a first-class input — not OCR'd text, not chunked embeddings, but the actual document. The AI reads figures, tables, application schematics, and design equations the way an engineer would.

**2. AI with tool use**
Modern LLMs can call external APIs mid-reasoning. That means Claude can calculate a feedback resistor value, then immediately search Digikey for a matching part — in a single coherent pipeline without human handoff.

**3. Interactive 2D diagrams are first-class browser citizens**
SVG + React makes it trivial to build fully interactive wiring diagrams — hover states, animated connection highlights, and floating annotation tables — with no install and no 3D overhead. The result is faster, more legible, and easier to act on than a rendered board.

These three capabilities didn't exist together 18 months ago. They do now.

---

## The Solution

PCB Copilot is a web application that takes a circuit description and an IC datasheet PDF, and in under 30 seconds produces:

- **Exact passive component values** — calculated from the datasheet's own design equations
- **A sourced bill of materials** — real part numbers, real prices, real stock levels from Digikey
- **An interactive 2D wiring diagram** — every component placed as a block, every connection drawn as a colored wire, every node hoverable to reveal a live connection table

**The wiring diagram is the interface.** Not a table. Not a form. You hover a component and instantly see every wire going in and out of it — labeled, color-coded, with gauge, length, and sourcing data. Hover a row in the connection table and that specific wire lights up on the diagram.

---

## How It Works — The AI Pipeline

Four sequential Claude calls, each building on the last:

**Step 1 — Datasheet Parser**
Claude receives the IC datasheet as a native PDF input alongside the user's specs (Vin, Vout, Iout). It extracts topology, design equations, pin maps, and the typical application circuit — outputting structured JSON. No chunking, no embeddings, no preprocessing. The model reads the document.

**Step 2 — Design Calculator**
Claude takes the extracted equations and the user's operating conditions, then solves them numerically. For a TPS563201 buck converter running 12V→5V at 2A and 500kHz, it outputs: R1=100kΩ, R2=22.1kΩ, L1=4.7µH, Cin=10µF, Cout=47µF, Cboot=100nF — the exact same values Texas Instruments recommends in their reference design.

**Step 3 — Parts Sourcer** *(parallel)*
For every BOM item, Claude runs a web search query against Digikey. In parallel. It finds a real stocking part, extracts the part number, price, package, and buy URL — and flags anything backordered. No Digikey API key. No scraper. Claude reads the search results the way a human would.

**Step 4 — Wiring Diagram Builder** *(algorithmic, no AI)*
The enriched BOM is mapped to a 2D connection graph using a deterministic layout algorithm. No AI involved here — component blocks are positioned in a hierarchical left-to-right layout, connections are drawn as cubic-bezier SVG paths colored by net/signal type, and pin labels are placed at each endpoint. The output is a `WiringGraph` JSON object consumed directly by the frontend. Fast, predictable, repeatable.

---

## The Interface

The 2D wiring diagram is not a decorative afterthought. It is the primary interface.

- **Full-viewport SVG canvas** — component blocks arranged in a clean hierarchical layout on a dark background. No dashboard chrome competing for attention.
- **Hover any component block** — all wires connected to that component illuminate. A connection table slides in below (or as an overlay) listing every net: Code, Label, From, To, AWG, Color, Length. Unrelated wires dim to subordinate contrast.
- **Hover any row in the connection table** — the corresponding wire on the diagram highlights with increased stroke weight and a glow effect, making it trivial to trace a specific signal across the board.
- **Colored wires by signal type** — power rails, ground, signal lines, and data buses each get a distinct color (matching physical wire colors where relevant). Colors are consistent between the diagram and the table's Color column.
- **Pin labels at endpoints** — each wire terminates at a labeled pin dot (P1, P3, P16, etc.) positioned at the component block edge, matching the physical connector pinout.
- **Sourcing panel** — clicking any component or wire opens a right-rail panel with the Digikey part number, price, stock, and a direct buy link.

Every connection is spatially grounded and table-verifiable. You understand the circuit by tracing wires — not by reading a standalone BOM.

---

## Demo Circuit

**IC:** Texas Instruments TPS563201 — Synchronous Buck Converter
**Specs:** 12V input → 5V output, 2A, 500kHz switching frequency

Expected pipeline output:

| Ref | Component | Value | Digikey Part | Price |
|-----|-----------|-------|--------------|-------|
| R1 | Feedback resistor (upper) | 100kΩ | RC0402FR-07100KL | $0.10 |
| R2 | Feedback resistor (lower) | 22.1kΩ | RC0402FR-0722K1L | $0.10 |
| L1 | Output inductor | 4.7µH, >2.5A | SRR1260-4R7Y | $0.68 |
| Cin | Input decoupling cap | 10µF 25V | C1210C106K3RACTU | $0.28 |
| Cout | Output filter cap | 47µF 10V | GRM32ER61A476ME20L | $0.43 |
| Cboot | Bootstrap cap | 100nF | GRM155R71C104KA88D | $0.10 |

**Total BOM cost: ~$1.69** — sourced, priced, and linked in under 30 seconds.

---

## Technical Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 14, React 19, Tailwind v4 | App Router, RSC, fast iteration |
| 2D Diagram | React + SVG (inline) | Zero-dependency wiring diagram; hover state, path animation, and pin labels via standard DOM events |
| Wire routing | Cubic-bezier SVG paths | Smooth, readable curves between component blocks; no layout library needed |
| Animations | Framer Motion | Spring-based panel transitions, wire highlight fade-in/out |
| AI | Anthropic claude-sonnet-4-6 | PDF input, tool use, web search |
| Streaming | Server-Sent Events (SSE) | Live pipeline status without WebSockets |
| Deploy | Vercel | Edge-ready, env var management |

---

## What Makes the AI Architecture Interesting

**Native PDF as model input** — no preprocessing pipeline, no vector database, no chunking strategy. The datasheet goes directly into the context window as a document block. Claude reads figures and tables directly.

**Tool use mid-pipeline** — parts sourcing uses Claude's `web_search` tool. The model decides what to search for, interprets the results, and extracts structured data — all without any Digikey API integration or custom scraper.

**Streaming with real-time state** — the frontend opens a single SSE connection and receives typed events (`{ type: "status" }`, `{ type: "result" }`). The UI updates live as each pipeline step completes. The wiring diagram rebuilds when the final `WiringGraph` arrives.

**Deterministic layout, not AI layout** — component placement and wire routing are algorithmic. This is intentional. AI-generated positions would be non-deterministic and hard to debug. The layout algorithm is fast, repeatable, and can be improved without touching the model.

---

## Current Status

| Feature | Status |
|---------|--------|
| SSE streaming pipeline | ✅ Working |
| Claude datasheet parser (Step 1) | ✅ Built |
| Claude design calculator (Step 2) | ✅ Built |
| Claude parts sourcer (Step 3) | ✅ Built |
| 2D wiring diagram canvas | 🔲 Phase 2 |
| Component hover → connection table | 🔲 Phase 2 |
| Table row hover → wire highlight | 🔲 Phase 2 |
| Real end-to-end AI pipeline | 🔲 Phase 2 |
| Algorithmic WiringGraph builder (Step 4) | 🔲 Phase 2 |
| BOM table + CSV export | 🔲 Phase 3 |
| Sourcing panel (click → Digikey link) | 🔲 Phase 3 |
| Vercel deployment | 🔲 Phase 4 |

---

## Development Phases

| Phase | Goal | Status |
|-------|------|--------|
| 1 — Fix & First Light | Bug fixes, canvas rendering, demo mode verified | ✅ Done |
| 2 — Real AI Pipeline | End-to-end Claude pipeline with real datasheet | 🔲 In progress |
| 3 — Polish | BOM table, assembly steps, depth of field, CSV export | 🔲 Upcoming |
| 4 — Deploy | Vercel, public URL, README | 🔲 Upcoming |

---

## The Bigger Picture

Buck converters are the demo. The architecture generalizes.

Any IC with a datasheet — op-amps, motor drivers, RF transceivers, battery chargers, microcontrollers — follows the same pattern: a PDF with design equations, a set of user specs, and a list of required passives. The pipeline is identical.

The longer-term vision: PCB Copilot becomes the interface layer between an engineer's intent and a manufacturable board. You describe what you want to build. The AI handles the translation — from spec to schematic to BOM to layout — and the interactive wiring diagram is how you verify, trace, and order.

The question isn't whether AI will change hardware design. It already is. The question is what the interface looks like.

**PCB Copilot is a bet that it looks like this.**

---

## Repo

**github.com/ShreyasRiddle/pcb-copilot**

```bash
git clone https://github.com/ShreyasRiddle/pcb-copilot.git
cd pcb-copilot
npm install
cp .env.example .env.local  # add ANTHROPIC_API_KEY
npm run dev                  # localhost:3000
```

---

## Developer Split — Two-Person Workflow

The codebase splits cleanly along the **AI backend / 2D frontend** boundary. The two tracks meet at a single typed interface: `WiringGraph` in `lib/types.ts`. Each person can develop and test independently — Person 2 uses a hardcoded `demoWiring.ts` fixture while Person 1's pipeline is in progress; the swap is a one-line change in the hook.

---

### Person 1 — AI Pipeline & Backend

**Primary files:** `app/api/design/route.ts`, `lib/pipeline.ts`, `lib/buildWiringGraph.ts`, `hooks/useCircuitPipeline.ts`

**Owns:**
- Phase 2 — Real end-to-end AI pipeline
  - Wire the four Claude steps together (`lib/pipeline.ts`)
  - Build `lib/buildWiringGraph.ts` — the deterministic algorithm that converts the enriched BOM into a `WiringGraph`: component blocks with (x, y) positions, connection edges with pin labels, colors, AWG, and length
  - Validate and normalize `WiringGraph` JSON before emitting via SSE
  - Ensure Step 3 parallel tool-use calls resolve correctly; every connection gets a real part number, price, and URL
- SSE streaming (`app/api/design/route.ts`)
  - Emit `{ type: "status", step: 1|2|3|4, message: string }` events as each step completes
  - Emit `{ type: "result", data: WiringGraph }` on success
  - Emit `{ type: "error", message: string }` on failure
  - Handle partial failures gracefully — backordered parts get `{ backordered: true }`, not dropped
- Phase 3 backend
  - `/api/export-bom` route — serialize BOM to CSV from `WiringGraph.nodes`
- Phase 4
  - Vercel env var setup, edge function audit, `.env.example`

**Contract delivered to Person 2:**
```ts
// lib/types.ts (owned by P1, agreed with P2 before implementation)
type WiringGraph = {
  nodes: ComponentNode[]   // component blocks with position + BOM data
  edges: ConnectionEdge[]  // wires with pin labels, color, AWG, length, backordered flag
}
type ComponentNode = {
  id: string; label: string; x: number; y: number
  bom?: { partNumber: string; price: number; url: string; backordered?: boolean }
}
type ConnectionEdge = {
  id: string; code: string; label: string
  from: string; fromPin: string; to: string; toPin: string
  color: string; awg: number; lengthCm: number; backordered?: boolean
}
```

---

### Person 2 — 2D Wiring Diagram & UI

**Primary files:** `components/WiringDiagram.tsx` *(new)*, `components/ConnectionTable.tsx` *(new)*, `components/SourcingPanel.tsx`, `components/InputDrawer.tsx`, `components/StatusBar.tsx`, `app/page.tsx`

**Owns:**
- Phase 2 — 2D interactive diagram
  - `components/WiringDiagram.tsx` — full-viewport SVG canvas rendering `WiringGraph`:
    - Component blocks as dark rounded-rect `<rect>` elements with white label text
    - Connection wires as cubic-bezier `<path>` elements, stroked in the edge's `color` field
    - Pin dots + labels (`P1`, `P16`, etc.) at each wire endpoint
    - On component hover: dim all unrelated wires to 20% opacity, highlight connected wires to full stroke + glow filter; show `ConnectionTable` for that node
    - On component blur: restore all wire opacity
  - `components/ConnectionTable.tsx` — connection table rendered below (or as overlay on) the diagram:
    - Columns: Code | Label | From | To | AWG | Color | Len
    - On row hover: find the matching `<path>` by edge ID and apply increased stroke-width + CSS drop-shadow; remove on mouse-out
    - Color swatch cell uses the wire's color value as a background dot
  - Connect `hooks/useCircuitPipeline.ts` so diagram rebuilds when a real `WiringGraph` arrives (use `demoWiring.ts` fixture until P1 is ready)
  - `StatusBar.tsx` — render live step labels from SSE status events
- Phase 3 polish
  - Sourcing panel — slide-in right-rail on component/wire click; Digikey part, price, stock, buy button
  - BOM table panel — full component list with CSV download (calls `/api/export-bom` from P1)
  - Backordered visual treatment — render backordered edges as dashed strokes with an amber color override; badge on component block
- Phase 4
  - Production build smoke test (`npm run build`, fix any SSR issues with SVG)
  - `README.md` demo GIF

**Contract consumed from Person 1:**
- `WiringGraph` type as defined above — do not reshape without coordinating
- SSE event shapes for `status`, `result`, `error`
- All SSE parsing lives in `hooks/useCircuitPipeline.ts` — diagram components receive only the parsed `WiringGraph`

---

### Shared / Coordinate Together

| Task | Notes |
|------|-------|
| `lib/types.ts` | Agree on `WiringGraph`, `ComponentNode`, `ConnectionEdge` shapes before either side codes against them |
| Color vocabulary | The `color` field on `ConnectionEdge` must be a valid CSS color string — agree on format (hex vs named) |
| Error states | Agree on `ErrorEvent` SSE payload shape so `StatusBar` can surface meaningful messages |
| Final integration test | Run full pipeline with TPS563201 datasheet; verify diagram wires match expected BOM connections |

---

### Suggested Work Order

```
Week 1
  P1: Wire pipeline steps 1–4; emit WiringGraph from buildWiringGraph.ts
  P2: Build WiringDiagram.tsx + ConnectionTable.tsx against demoWiring.ts fixture

Week 2
  P1: Harden parts sourcer (backorder flags, retry); add /api/export-bom
  P2: Wire hover → table, table row hover → wire highlight; connect live SSE hook

Week 3
  P1: Vercel config, env var audit, edge function review
  P2: Sourcing panel, BOM panel + CSV download, backordered visual treatment

Week 4 (buffer)
  Both: Full end-to-end integration test, README, demo GIF, deploy to Vercel
```
