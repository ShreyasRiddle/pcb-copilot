"use client";

import { ComponentNode } from "@/lib/types";

interface BomTableProps {
  nodes: ComponentNode[];
}

function parsePrice(price: string | undefined): number | null {
  if (!price) return null;
  const n = parseFloat(price.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

export default function BomTable({ nodes }: BomTableProps) {
  if (!nodes.length) return null;

  const prices = nodes.map((n) => parsePrice(n.bom?.price));
  const allPriced = prices.every((p) => p !== null);
  const total = allPriced
    ? prices.reduce((sum, p) => sum! + p!, 0)!.toFixed(2)
    : null;

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
          color: "var(--text-2)",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: "1px solid var(--border)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            {["Ref", "Label", "Part Number", "Price", "Stock"].map((h) => (
              <th
                key={h}
                style={{
                  padding: "10px 16px",
                  textAlign: "left",
                  fontFamily: "var(--font-space), system-ui, sans-serif",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {nodes.map((node, i) => (
            <tr
              key={node.id}
              style={{
                borderBottom: "1px solid var(--border)",
                transition: "background 120ms",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLTableRowElement).style.background =
                  "rgba(255,255,255,0.025)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLTableRowElement).style.background =
                  "transparent")
              }
            >
              {/* Ref */}
              <td style={{ padding: "10px 16px" }}>
                <span
                  style={{
                    fontFamily: "var(--font-geist-mono), monospace",
                    fontSize: 12,
                    color: "var(--accent)",
                    background: "var(--accent-dim)",
                    padding: "2px 7px",
                    borderRadius: 5,
                  }}
                >
                  {node.id}
                </span>
              </td>

              {/* Label */}
              <td
                style={{
                  padding: "10px 16px",
                  color: "var(--text-1)",
                  fontWeight: 500,
                }}
              >
                {node.label.replace(/\n/g, " ")}
              </td>

              {/* Part Number */}
              <td style={{ padding: "10px 16px" }}>
                {node.bom?.url ? (
                  <a
                    href={node.bom.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "var(--text-2)",
                      textDecoration: "none",
                      fontFamily: "var(--font-geist-mono), monospace",
                      fontSize: 12,
                      transition: "color 120ms",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLAnchorElement).style.color =
                        "var(--text-1)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLAnchorElement).style.color =
                        "var(--text-2)")
                    }
                  >
                    {node.bom.partNumber} ↗
                  </a>
                ) : (
                  <span
                    style={{
                      fontFamily: "var(--font-geist-mono), monospace",
                      fontSize: 12,
                    }}
                  >
                    {node.bom?.partNumber ?? "—"}
                  </span>
                )}
              </td>

              {/* Price */}
              <td style={{ padding: "10px 16px" }}>
                {node.bom?.price ? (
                  <span style={{ color: "var(--text-1)", fontWeight: 500 }}>
                    {node.bom.price}
                  </span>
                ) : (
                  <span style={{ color: "var(--text-3)" }}>—</span>
                )}
              </td>

              {/* Stock */}
              <td style={{ padding: "10px 16px" }}>
                {!node.bom ? (
                  <span style={{ color: "var(--text-3)" }}>—</span>
                ) : node.bom.backordered ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      color: "#f59e0b",
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#f59e0b",
                        flexShrink: 0,
                      }}
                    />
                    Backordered
                  </span>
                ) : (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      color: "#34d399",
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#34d399",
                        flexShrink: 0,
                      }}
                    />
                    In Stock
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>

        {/* Total row */}
        <tfoot>
          <tr
            style={{
              background: "rgba(255,255,255,0.02)",
              borderTop: "1px solid var(--border-mid)",
            }}
          >
            <td
              colSpan={3}
              style={{
                padding: "10px 16px",
                fontSize: 11,
                fontFamily: "var(--font-space), system-ui, sans-serif",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-3)",
              }}
            >
              Total · qty 1 each
            </td>
            <td style={{ padding: "10px 16px" }}>
              {total !== null ? (
                <span
                  style={{
                    color: "var(--text-1)",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  ${total}
                </span>
              ) : (
                <span style={{ color: "var(--text-3)", fontSize: 13 }}>—</span>
              )}
            </td>
            <td style={{ padding: "10px 16px" }} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
