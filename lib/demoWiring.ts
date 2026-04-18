import { WiringGraph } from "./types";

/**
 * Hardcoded WiringGraph for the TPS563201 demo circuit.
 * Used by Person 2 as a development fixture while the live pipeline is in progress.
 * Matches the BOM in content.md: 12V→5V, 2A, 500kHz buck converter.
 */
export const DEMO_WIRING: WiringGraph = {
  nodes: [
    {
      id: "Cin",
      label: "Cin",
      x: 80,
      y: 200,
      bom: {
        partNumber: "C1210C106K3RACTU",
        price: "$0.28",
        url: "https://www.digikey.com/en/products/detail/kemet/C1210C106K3RACTU/3988084",
      },
    },
    {
      id: "U1",
      label: "U1\nTPS563201",
      x: 290,
      y: 200,
      bom: {
        partNumber: "TPS563201DDCR",
        price: "$0.62",
        url: "https://www.digikey.com/en/products/detail/texas-instruments/TPS563201DDCR/5012183",
      },
    },
    {
      id: "L1",
      label: "L1",
      x: 500,
      y: 120,
      bom: {
        partNumber: "SRR1260-4R7Y",
        price: "$0.68",
        url: "https://www.digikey.com/en/products/detail/bourns-inc/SRR1260-4R7Y/2756070",
      },
    },
    {
      id: "Cboot",
      label: "Cboot",
      x: 500,
      y: 300,
      bom: {
        partNumber: "GRM155R71C104KA88D",
        price: "$0.10",
        url: "https://www.digikey.com/en/products/detail/murata-electronics/GRM155R71C104KA88D/490-1532",
      },
    },
    {
      id: "Cout",
      label: "Cout",
      x: 700,
      y: 120,
      bom: {
        partNumber: "GRM32ER61A476ME20L",
        price: "$0.43",
        url: "https://www.digikey.com/en/products/detail/murata-electronics/GRM32ER61A476ME20L/4936771",
      },
    },
    {
      id: "R1",
      label: "R1",
      x: 700,
      y: 280,
      bom: {
        partNumber: "RC0402FR-07100KL",
        price: "$0.10",
        url: "https://www.digikey.com/en/products/detail/yageo/RC0402FR-07100KL/726764",
      },
    },
    {
      id: "R2",
      label: "R2",
      x: 700,
      y: 380,
      bom: {
        partNumber: "RC0402FR-0722K1L",
        price: "$0.10",
        url: "https://www.digikey.com/en/products/detail/yageo/RC0402FR-0722K1L/728024",
      },
    },
  ],
  edges: [
    {
      id: "edge-0",
      code: "A",
      label: "VIN",
      from: "Cin", fromPin: "P+",
      to:   "U1",  toPin:   "VIN",
      color: "#ef4444", awg: 20, lengthCm: 8,
    },
    {
      id: "edge-1",
      code: "B",
      label: "GND",
      from: "Cin", fromPin: "P−",
      to:   "U1",  toPin:   "GND",
      color: "#6b7280", awg: 20, lengthCm: 9,
    },
    {
      id: "edge-2",
      code: "C",
      label: "SW",
      from: "U1", fromPin: "SW",
      to:   "L1", toPin:   "P1",
      color: "#f97316", awg: 24, lengthCm: 7,
    },
    {
      id: "edge-3",
      code: "D",
      label: "VOUT",
      from: "L1",   fromPin: "P2",
      to:   "Cout", toPin:   "P+",
      color: "#22c55e", awg: 24, lengthCm: 6,
    },
    {
      id: "edge-4",
      code: "E",
      label: "VOUT_FB",
      from: "Cout", fromPin: "P+",
      to:   "R1",   toPin:   "P1",
      color: "#22c55e", awg: 24, lengthCm: 5,
    },
    {
      id: "edge-5",
      code: "F",
      label: "FB",
      from: "R1", fromPin: "P2",
      to:   "R2", toPin:   "P1",
      color: "#3b82f6", awg: 24, lengthCm: 4,
    },
    {
      id: "edge-6",
      code: "G",
      label: "FB_PIN",
      from: "R1", fromPin: "P2",
      to:   "U1", toPin:   "FB",
      color: "#3b82f6", awg: 24, lengthCm: 14,
    },
    {
      id: "edge-7",
      code: "H",
      label: "GND_FB",
      from: "R2",   fromPin: "P2",
      to:   "Cout", toPin:   "P−",
      color: "#6b7280", awg: 24, lengthCm: 4,
    },
    {
      id: "edge-8",
      code: "I",
      label: "BOOT",
      from: "U1",    fromPin: "SW",
      to:   "Cboot", toPin:   "P1",
      color: "#a855f7", awg: 24, lengthCm: 5,
    },
    {
      id: "edge-9",
      code: "J",
      label: "BOOT_PIN",
      from: "Cboot", fromPin: "P2",
      to:   "U1",    toPin:   "BOOT",
      color: "#a855f7", awg: 24, lengthCm: 5,
    },
  ],
};
