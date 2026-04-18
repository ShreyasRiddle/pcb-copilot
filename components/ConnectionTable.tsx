"use client";

import { ConnectionEdge } from "@/lib/types";

interface ConnectionTableProps {
  edges: ConnectionEdge[];
  onEdgeHighlight: (id: string | null) => void;
}

export default function ConnectionTable({ edges, onEdgeHighlight }: ConnectionTableProps) {
  return (
    <div
      style={{
        background: "rgba(13, 13, 20, 0.96)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(110,231,247,0.06)",
        backdropFilter: "blur(12px)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          padding: "8px 12px 6px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          fontSize: 10,
          fontFamily: "var(--font-space), system-ui, sans-serif",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(110,231,247,0.5)",
        }}
      >
        Connections
      </div>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 11,
          fontFamily: "var(--font-geist-mono), monospace",
        }}
      >
        <thead>
          <tr
            style={{
              background: "rgba(255,255,255,0.025)",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            {["Code", "Label", "From", "From Pin", "To", "To Pin", "AWG", "●", "Len"].map((h, i) => (
              <th
                key={i}
                style={{
                  padding: "5px 8px",
                  textAlign: "left",
                  fontSize: 9,
                  fontFamily: "var(--font-space), system-ui, sans-serif",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.25)",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {edges.map((edge, i) => (
            <tr
              key={edge.id}
              style={{
                borderBottom:
                  i < edges.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                pointerEvents: "auto",
                cursor: "default",
                transition: "background 100ms",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLTableRowElement).style.background =
                  "rgba(110,231,247,0.05)";
                onEdgeHighlight(edge.id);
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                onEdgeHighlight(null);
              }}
            >
              <td style={{ padding: "5px 8px", color: "rgba(110,231,247,0.7)", fontWeight: 600 }}>
                {edge.code}
              </td>
              <td style={{ padding: "5px 8px", color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>
                {edge.label}
              </td>
              <td style={{ padding: "5px 8px", color: "rgba(255,255,255,0.5)" }}>{edge.from}</td>
              <td style={{ padding: "5px 8px", color: "rgba(255,255,255,0.3)" }}>{edge.fromPin}</td>
              <td style={{ padding: "5px 8px", color: "rgba(255,255,255,0.5)" }}>{edge.to}</td>
              <td style={{ padding: "5px 8px", color: "rgba(255,255,255,0.3)" }}>{edge.toPin}</td>
              <td style={{ padding: "5px 8px", color: "rgba(255,255,255,0.35)" }}>{edge.awg}</td>
              <td style={{ padding: "5px 8px" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: edge.backordered ? "#f59e0b" : edge.color,
                    boxShadow: `0 0 4px ${edge.backordered ? "#f59e0b" : edge.color}`,
                  }}
                />
              </td>
              <td style={{ padding: "5px 8px", color: "rgba(255,255,255,0.3)" }}>
                {edge.lengthCm}cm
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
