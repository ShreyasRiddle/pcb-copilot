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

**3. 3D rendering in the browser is now trivial**
react-three-fiber brings Three.js into React. What used to require a dedicated CAD application now runs at 60fps in a browser tab, zero install required.

These three capabilities didn't exist together 18 months ago. They do now.

---

## The Solution

PCB Copilot is a web application that takes a circuit description and an IC datasheet PDF, and in under 30 seconds produces:

- **Exact passive component values** — calculated from the datasheet's own design equations
- **A sourced bill of materials** — real part numbers, real prices, real stock levels from Digikey
- **An interactive 3D circuit board** — every component placed, clickable, and linked to purchase

**The 3D board is the interface.** Not a table. Not a form. You click a capacitor and see why it's 47µF, what it costs, and a direct link to buy it.

---

## How It Works — The AI Pipeline

Four sequential Claude calls, each building on the last:

**Step 1 — Datasheet Parser**
Claude receives the IC datasheet as a native PDF input alongside the user's specs (Vin, Vout, Iout). It extracts topology, design equations, pin maps, and the typical application circuit — outputting structured JSON. No chunking, no embeddings, no preprocessing. The model reads the document.

**Step 2 — Design Calculator**
Claude takes the extracted equations and the user's operating conditions, then solves them numerically. For a TPS563201 buck converter running 12V→5V at 2A and 500kHz, it outputs: R1=100kΩ, R2=22.1kΩ, L1=4.7µH, Cin=10µF, Cout=47µF, Cboot=100nF — the exact same values Texas Instruments recommends in their reference design.

**Step 3 — Parts Sourcer** *(parallel)*
For every BOM item, Claude runs a web search query against Digikey. In parallel. It finds a real stocking part, extracts the part number, price, package, and buy URL — and flags anything backordered. No Digikey API key. No scraper. Claude reads the search results the way a human would.

**Step 4 — Scene Graph Builder** *(algorithmic, no AI)*
The enriched BOM is mapped to a 3D grid using a deterministic layout algorithm. No AI involved here — component positions are calculated, Manhattan traces are routed, and the scene graph is returned as JSON. Fast, predictable, repeatable.

---

## The Interface

The 3D board is not a decorative afterthought. It is the primary interface.

- **Full-screen canvas** — the PCB occupies the entire viewport. No dashboard chrome, no sidebar competing for attention.
- **Hover any component** — it glows. Bloom postprocessing makes the emissive highlight physically accurate.
- **Click any component** — the camera smoothly orbits to face it. A floating annotation card appears at the component's 3D position showing value and design rationale. A sourcing panel slides in from the right showing the real Digikey part, price, and a buy button.
- **Animated traces** — copper-colored dashes flow along the circuit paths suggesting current direction.
- **OrbitControls** — drag to rotate, scroll to zoom, right-click to pan. The board is explorable.

Every design decision is spatially grounded. You understand the circuit by interacting with it — not by reading a table.

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
| 3D Rendering | react-three-fiber, @react-three/drei | Declarative Three.js, `<Html>` worldspace |
| Post-processing | @react-three/postprocessing | Bloom, depth of field |
| Animations | Framer Motion | Spring-based panel transitions |
| AI | Anthropic claude-sonnet-4-6 | PDF input, tool use, web search |
| Streaming | Server-Sent Events (SSE) | Live pipeline status without WebSockets |
| Deploy | Vercel | Edge-ready, env var management |

---

## What Makes the AI Architecture Interesting

**Native PDF as model input** — no preprocessing pipeline, no vector database, no chunking strategy. The datasheet goes directly into the context window as a document block. Claude reads figures and tables directly.

**Tool use mid-pipeline** — parts sourcing uses Claude's `web_search` tool. The model decides what to search for, interprets the results, and extracts structured data — all without any Digikey API integration or custom scraper.

**Streaming with real-time state** — the frontend opens a single SSE connection and receives typed events (`{ type: "status" }`, `{ type: "result" }`). The UI updates live as each pipeline step completes. The 3D scene rebuilds when the final result arrives.

**Deterministic layout, not AI layout** — component placement is algorithmic. This is intentional. AI-generated positions would be non-deterministic and hard to debug. The layout algorithm is fast, repeatable, and can be improved without touching the model.

---

## Current Status

| Feature | Status |
|---------|--------|
| 3D canvas with full interaction | ✅ Working |
| Demo scene (TPS563201, hardcoded) | ✅ Working |
| SSE streaming pipeline | ✅ Working |
| Claude datasheet parser (Step 1) | ✅ Built |
| Claude design calculator (Step 2) | ✅ Built |
| Claude parts sourcer (Step 3) | ✅ Built |
| Algorithmic scene graph (Step 4) | ✅ Working |
| Real end-to-end AI pipeline | 🔲 Phase 2 |
| BOM table + CSV export | 🔲 Phase 3 |
| Assembly instructions panel | 🔲 Phase 3 |
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

The longer-term vision: PCB Copilot becomes the interface layer between an engineer's intent and a manufacturable board. You describe what you want to build. The AI handles the translation — from spec to schematic to BOM to layout — and the 3D board is how you verify, explore, and order.

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
