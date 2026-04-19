/**
 * Server-side SKiDL generation and iterative repair.
 *
 * Two public functions:
 *   generateInitialScript(graph, apiKey)  — Gemini generates a SKiDL script
 *                                           using tool=SKIDL + explicit Pin() defs
 *   runAndRepair(script, apiKey, onStatus, maxIter)
 *                                         — run Python, capture ERC errors,
 *                                           ask Gemini to fix, repeat until clean
 *
 * The SKIDL_PYTHON env var (set in Dockerfile) points at the venv Python binary.
 * Falls back to `python3` for local dev (requires `pip install skidl`).
 */

import { exec } from "child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { GoogleGenAI } from "@google/genai";
import { WiringGraph } from "./types";

const execAsync = promisify(exec);
const MODEL = "gemini-2.5-flash";
const PYTHON_BIN = process.env.SKIDL_PYTHON ?? "python3";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RepairResult {
  success: boolean;
  script: string;
  /** Base64-encoded .net file, only present when success === true */
  netlist?: string;
  /** Human-readable summary of what happened across iterations */
  log: string[];
}

// ── Gemini: initial script generation ────────────────────────────────────────

export async function generateInitialScript(
  graph: WiringGraph,
  apiKey: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  // Summarise the graph for the prompt
  const componentList = graph.nodes
    .map((n) => `  - ref=${n.id}, label="${n.label.replace(/\n/g, " ")}"`)
    .join("\n");

  const connectionList = graph.edges
    .map(
      (e) =>
        `  - net="${e.label}" from ${e.from}[${e.fromPin}] to ${e.to}[${e.toPin}]`
    )
    .join("\n");

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are an expert hardware engineer writing SKiDL Python scripts for KiCad.

Generate a complete, runnable SKiDL Python script for the following circuit.

COMPONENTS:
${componentList}

CONNECTIONS (netlist):
${connectionList}

STRICT REQUIREMENTS — follow every one or the script will fail:

1. Import: \`from skidl import *\` only.

2. Every component MUST use \`tool=SKIDL\` with explicit Pin() objects.
   Never use Part('Device', 'R') or any KiCad library name.
   Example for a 2-pin passive (resistor/capacitor/inductor):
     r1 = Part(tool=SKIDL, name='R', ref='R1', value='10k',
               pins=[Pin(num=1, name='1', func=Pin.types.PASSIVE),
                     Pin(num=2, name='2', func=Pin.types.PASSIVE)])

3. For ICs, define every pin that appears in the connections list.
   Use Pin.types.PWRIN for power-input pins (VCC/VIN/VS),
   Pin.types.PWROUT for GND/PGND,
   Pin.types.OUTPUT for SW/OUT pins,
   Pin.types.INPUT for FB/BOOT/EN pins,
   Pin.types.BIDIR for any ambiguous pins.
   Example:
     u1 = Part(tool=SKIDL, name='TPS563201', ref='U1', value='TPS563201',
               pins=[Pin(num=1, name='VIN',  func=Pin.types.PWRIN),
                     Pin(num=2, name='GND',  func=Pin.types.PWROUT),
                     Pin(num=3, name='SW',   func=Pin.types.OUTPUT),
                     Pin(num=4, name='FB',   func=Pin.types.INPUT),
                     Pin(num=5, name='BOOT', func=Pin.types.INPUT)])

4. Declare nets with Net(). Use exact net label strings from the connections list.
   gnd  = Net('GND')
   vin  = Net('VIN')
   vout = Net('VOUT')
   (etc. for every net that appears in the connections)

5. Connect pins to nets using +=:
     u1['VIN'] += vin
   Pin names in brackets must EXACTLY match the name= given in the Pin() definition.

6. For passives, pin names are '1' and '2' — always use those in connections:
     r1['1'] += fb_net
     r1['2'] += gnd

7. Add a PWR_FLAG on every power net (VIN, VCC, VOUT, GND) to avoid ERC errors:
     pwr_vin = Part(tool=SKIDL, name='PWR_FLAG', ref='PWR1',
                    pins=[Pin(num=1, name='PWR', func=Pin.types.PWROUT)])
     pwr_vin['PWR'] += vin

8. End the script with:
     ERC()
     generate_netlist(file_='circuit.net')

Return ONLY the Python code — no markdown, no explanation, no code fences.`,
          },
        ],
      },
    ],
  });

  let script = res.text ?? "";
  // Strip any accidental markdown fences
  script = script.replace(/^```(?:python)?\s*/m, "").replace(/\s*```\s*$/m, "");
  return script.trim();
}

// ── Python execution ──────────────────────────────────────────────────────────

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function runPython(script: string, workDir: string): Promise<RunResult> {
  const scriptPath = join(workDir, "circuit.py");
  writeFileSync(scriptPath, script, "utf-8");

  try {
    const { stdout, stderr } = await execAsync(
      `${PYTHON_BIN} ${scriptPath}`,
      { cwd: workDir, timeout: 60_000 }
    );
    return { code: 0, stdout, stderr };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      code: e.code ?? 1,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? String(err),
    };
  }
}

// ── Gemini: repair a broken script ───────────────────────────────────────────

async function repairScript(
  script: string,
  errors: string,
  apiKey: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `The following SKiDL Python script failed to run. Fix ONLY the errors shown.

Common causes and fixes:
- PinNameError / KeyError on pin lookup: the pin name in brackets doesn't match the name= in Pin(). Fix the bracket string to match exactly.
- AttributeError on Pin.types.XXX: use only PASSIVE, PWRIN, PWROUT, INPUT, OUTPUT, BIDIR, TRISTATE, OPENCOLL.
- ERC errors about undriven power pins: add a PWR_FLAG part connected to that net.
- generate_netlist / ERC import errors: ensure \`from skidl import *\` is the first line.
- TypeError on Part(): always include tool=SKIDL and a pins= list.

--- ERRORS (stdout + stderr) ---
${errors.slice(0, 4000)}

--- CURRENT SCRIPT ---
${script}

Return ONLY the corrected Python script. No markdown, no explanation, no code fences.`,
          },
        ],
      },
    ],
  });

  let fixed = res.text ?? script;
  fixed = fixed.replace(/^```(?:python)?\s*/m, "").replace(/\s*```\s*$/m, "");
  return fixed.trim();
}

// ── Main: run + repair loop ───────────────────────────────────────────────────

export async function runAndRepair(
  initialScript: string,
  apiKey: string,
  onStatus: (msg: string) => void,
  maxIter = 3
): Promise<RepairResult> {
  const workDir = mkdtempSync(join(tmpdir(), "skidl-"));
  const log: string[] = [];
  let script = initialScript;

  for (let i = 0; i < maxIter; i++) {
    const iterLabel = `${i + 1}/${maxIter}`;
    onStatus(`Running ERC check (attempt ${iterLabel})…`);
    log.push(`--- Attempt ${iterLabel} ---`);

    const { code, stdout, stderr } = await runPython(script, workDir);
    const combined = (stdout + "\n" + stderr).trim();
    log.push(combined || "(no output)");

    // SKiDL always exits 0, even when ERC finds errors — parse output explicitly.
    // SKiDL 0.0.36 prints lines like:
    //   "ERC: 3 error(s) found"  or  "ERC: 0 error(s) found"
    const ercMatch = combined.match(/ERC:\s*(\d+)\s*error/i);
    const ercErrors = ercMatch ? parseInt(ercMatch[1], 10) : null;

    const netPath = join(workDir, "circuit.net");
    const netExists = existsSync(netPath);

    // True success: process exited cleanly, netlist was written, and ERC reports 0 errors
    const ercClean = ercErrors === 0;
    if (code === 0 && netExists && ercClean) {
      log.push("ERC passed — 0 errors. Netlist generated.");
      const netlistBuf = readFileSync(netPath);
      return {
        success: true,
        script,
        netlist: netlistBuf.toString("base64"),
        log,
      };
    }

    // Log why we're continuing to repair
    if (code !== 0) log.push(`Process exited with code ${code}.`);
    if (!netExists)   log.push("circuit.net was not created.");
    if (ercErrors === null) log.push("No ERC output found — treating as failure.");
    if (ercErrors && ercErrors > 0) log.push(`ERC reported ${ercErrors} error(s).`);

    // Script failed — ask Gemini to fix it
    if (i < maxIter - 1) {
      onStatus(`Repairing errors (attempt ${iterLabel})…`);
      script = await repairScript(script, combined, apiKey);
      log.push("Gemini repair applied.");
    } else {
      log.push("Max iterations reached — returning last script.");
    }
  }

  return { success: false, script, log };
}
