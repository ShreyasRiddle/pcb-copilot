"use client";

import { useState, useCallback, useMemo } from "react";
import { ComponentNode, ConnectionEdge, WiringGraph } from "@/lib/types";
import ConnectionTable from "./ConnectionTable";

interface WiringDiagramProps {
  wiringGraph: WiringGraph;
  hoveredNodeId: string | null;
  highlightedEdgeId: string | null;
  onNodeHover: (node: ComponentNode | null) => void;
  onNodeClick: (node: ComponentNode | null) => void;
  onEdgeHighlight: (edgeId: string | null) => void;
}

const BLOCK_W = 120;
const BLOCK_H = 52;
const PADDING = 90;

// ── Geometry helpers ──────────────────────────────────────────────────────────

function edgeEndpoints(
  from: ComponentNode,
  to: ComponentNode
): { fx: number; fy: number; tx: number; ty: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) >= Math.abs(dy) || Math.abs(dx) > 30) {
    if (dx >= 0) {
      return { fx: from.x + BLOCK_W / 2, fy: from.y, tx: to.x - BLOCK_W / 2, ty: to.y };
    } else {
      return { fx: from.x - BLOCK_W / 2, fy: from.y, tx: to.x + BLOCK_W / 2, ty: to.y };
    }
  } else {
    if (dy >= 0) {
      return { fx: from.x, fy: from.y + BLOCK_H / 2, tx: to.x, ty: to.y - BLOCK_H / 2 };
    } else {
      return { fx: from.x, fy: from.y - BLOCK_H / 2, tx: to.x, ty: to.y + BLOCK_H / 2 };
    }
  }
}

function cubicPath(fx: number, fy: number, tx: number, ty: number): string {
  const dx = Math.abs(tx - fx);
  const dy = Math.abs(ty - fy);
  const isHoriz = dx > dy;
  const pull = isHoriz ? Math.max(dx * 0.5, 40) : Math.max(dy * 0.5, 40);

  if (isHoriz) {
    const cx1 = fx + (tx > fx ? pull : -pull);
    const cx2 = tx + (tx > fx ? -pull : pull);
    return `M ${fx},${fy} C ${cx1},${fy} ${cx2},${ty} ${tx},${ty}`;
  } else {
    const cy1 = fy + (ty > fy ? pull : -pull);
    const cy2 = ty + (ty > fy ? -pull : pull);
    return `M ${fx},${fy} C ${fx},${cy1} ${tx},${cy2} ${tx},${ty}`;
  }
}

function filterId(edgeId: string): string {
  return `glow-${edgeId.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

function nodeGradId(nodeId: string, hovered: boolean): string {
  return `grad-${nodeId.replace(/[^a-zA-Z0-9]/g, "_")}-${hovered ? "h" : "n"}`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WiringDiagram({
  wiringGraph,
  hoveredNodeId,
  highlightedEdgeId,
  onNodeHover,
  onNodeClick,
  onEdgeHighlight,
}: WiringDiagramProps) {
  const { nodes, edges } = wiringGraph;
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [containerWidth, setContainerWidth] = useState(900);

  const nodeMap = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.id, n])),
    [nodes]
  );

  const hoveredEdgeIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    return new Set(
      edges
        .filter((e) => e.from === hoveredNodeId || e.to === hoveredNodeId)
        .map((e) => e.id)
    );
  }, [hoveredNodeId, edges]);

  const hoveredNodeEdges = useMemo(() => {
    if (!hoveredNodeId) return [] as ConnectionEdge[];
    return edges.filter((e) => e.from === hoveredNodeId || e.to === hoveredNodeId);
  }, [hoveredNodeId, edges]);

  const viewBox = useMemo(() => {
    if (nodes.length === 0) return `0 0 900 520`;
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs) - BLOCK_W / 2 - PADDING;
    const minY = Math.min(...ys) - BLOCK_H / 2 - PADDING;
    const maxX = Math.max(...xs) + BLOCK_W / 2 + PADDING;
    const maxY = Math.max(...ys) + BLOCK_H / 2 + PADDING;
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  }, [nodes]);

  // For the dot-grid pattern we need the viewBox dimensions
  const vbParts = useMemo(() => {
    const parts = viewBox.split(" ").map(Number);
    return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
  }, [viewBox]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setContainerWidth(rect.width);
  }, []);

  const CARD_WIDTH = 400;
  const flipLeft = mousePos.x + CARD_WIDTH + 24 > containerWidth;

  return (
    <div
      style={{
        position: "relative",
        height: 560,
        background: "#0c0c14",
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflow: "hidden",
        cursor: "crosshair",
      }}
      onMouseMove={handleMouseMove}
    >
      <svg
        style={{ width: "100%", height: "100%", display: "block" }}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* ── Dot-grid background pattern ── */}
          <pattern
            id="dot-grid"
            x={vbParts.x % 30}
            y={vbParts.y % 30}
            width={30}
            height={30}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={15} cy={15} r={1} fill="rgba(255,255,255,0.055)" />
          </pattern>

          {/* ── Node gradients ── */}
          {nodes.map((node) => {
            const isHovered = hoveredNodeId === node.id;
            return (
              <linearGradient
                key={`grad-${node.id}-${isHovered}`}
                id={nodeGradId(node.id, isHovered)}
                x1="0" y1="0" x2="0" y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={isHovered ? "#2a2a40" : "#1e1e2c"}
                />
                <stop
                  offset="100%"
                  stopColor={isHovered ? "#1c1c2e" : "#14141f"}
                />
              </linearGradient>
            );
          })}

          {/* ── Edge glow filters ── */}
          {edges.map((edge) => (
            <filter
              key={edge.id}
              id={filterId(edge.id)}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="4"
                floodColor={edge.color}
                floodOpacity="0.85"
              />
            </filter>
          ))}
        </defs>

        {/* ── Dot-grid background ── */}
        <rect
          x={vbParts.x}
          y={vbParts.y}
          width={vbParts.w}
          height={vbParts.h}
          fill="url(#dot-grid)"
        />

        {/* ── Edges ── */}
        {edges.map((edge) => {
          const fromNode = nodeMap[edge.from];
          const toNode = nodeMap[edge.to];
          if (!fromNode || !toNode) return null;

          const { fx, fy, tx, ty } = edgeEndpoints(fromNode, toNode);
          const path = cubicPath(fx, fy, tx, ty);

          const isConnectedToHovered = hoveredNodeId ? hoveredEdgeIds.has(edge.id) : false;
          const isHighlighted = edge.id === highlightedEdgeId;
          const dimmed = hoveredNodeId !== null && !isConnectedToHovered;
          const backordered = edge.backordered === true;
          const strokeColor = backordered ? "#f59e0b" : edge.color;

          let strokeWidth = 2;
          if (isHighlighted) strokeWidth = 4.5;
          else if (isConnectedToHovered) strokeWidth = 3.5;

          const opacity = dimmed ? 0.07 : 1;
          const useFilter = isHighlighted || isConnectedToHovered;

          return (
            <g key={edge.id}>
              {/* Ghost wider path for easier hover area on edges */}
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
              />
              <path
                d={path}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={backordered ? "6 4" : undefined}
                strokeLinecap="round"
                opacity={opacity}
                filter={useFilter ? `url(#${filterId(edge.id)})` : "none"}
                style={{ transition: "opacity 150ms ease, stroke-width 120ms ease" }}
              />
              {/* Pin endpoints */}
              <circle cx={fx} cy={fy} r={3} fill={strokeColor} fillOpacity={opacity * 0.5} />
              <text
                x={fx}
                y={fy - 8}
                textAnchor="middle"
                fontSize={7.5}
                fill="rgba(255,255,255,0.35)"
                fontFamily="monospace"
                opacity={opacity}
              >
                {edge.fromPin}
              </text>
              <circle cx={tx} cy={ty} r={3} fill={strokeColor} fillOpacity={opacity * 0.5} />
              <text
                x={tx}
                y={ty - 8}
                textAnchor="middle"
                fontSize={7.5}
                fill="rgba(255,255,255,0.35)"
                fontFamily="monospace"
                opacity={opacity}
              >
                {edge.toPin}
              </text>
            </g>
          );
        })}

        {/* ── Nodes ── */}
        {nodes.map((node) => {
          const rx = node.x - BLOCK_W / 2;
          const ry = node.y - BLOCK_H / 2;
          const isHovered = hoveredNodeId === node.id;
          const backordered = node.bom?.backordered === true;

          return (
            <g
              key={node.id}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => onNodeHover(node)}
              onMouseLeave={() => onNodeHover(null)}
              onClick={() => onNodeClick(node)}
            >
              {/* Outer halo on hover */}
              {isHovered && (
                <rect
                  x={rx - 6}
                  y={ry - 6}
                  width={BLOCK_W + 12}
                  height={BLOCK_H + 12}
                  rx={14}
                  fill="rgba(110,231,247,0.04)"
                  stroke="rgba(110,231,247,0.2)"
                  strokeWidth={1}
                />
              )}

              {/* Main block */}
              <rect
                x={rx}
                y={ry}
                width={BLOCK_W}
                height={BLOCK_H}
                rx={9}
                fill={`url(#${nodeGradId(node.id, isHovered)})`}
                stroke={
                  backordered
                    ? "#f59e0b"
                    : isHovered
                    ? "rgba(110,231,247,0.55)"
                    : "rgba(255,255,255,0.1)"
                }
                strokeWidth={isHovered ? 1.5 : 1}
                style={{ transition: "stroke 150ms ease" }}
              />

              {/* Inner subtle top-edge highlight */}
              <rect
                x={rx + 1}
                y={ry + 1}
                width={BLOCK_W - 2}
                height={4}
                rx={8}
                fill={isHovered ? "rgba(110,231,247,0.12)" : "rgba(255,255,255,0.04)"}
                style={{ transition: "fill 150ms ease" }}
              />

              {/* Backordered badge */}
              {backordered && (
                <circle cx={rx + BLOCK_W - 8} cy={ry + 8} r={5} fill="#f59e0b" />
              )}

              {/* Label lines */}
              {node.label.split("\n").map((line, i, arr) => {
                const totalLines = arr.length;
                const lineHeight = 14;
                const offsetY = (i - (totalLines - 1) / 2) * lineHeight;
                const isFirst = i === 0;
                return (
                  <text
                    key={i}
                    x={node.x}
                    y={node.y + offsetY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={isFirst && totalLines > 1 ? 10 : 11}
                    fontFamily="monospace"
                    fontWeight={isFirst ? "600" : "400"}
                    fill={isHovered ? "#ffffff" : isFirst ? "#d8d8e8" : "#9090a8"}
                    style={{ transition: "fill 150ms ease", userSelect: "none" }}
                  >
                    {line}
                  </text>
                );
              })}

              {/* Ref label below block */}
              <text
                x={node.x}
                y={ry + BLOCK_H + 13}
                textAnchor="middle"
                fontSize={8.5}
                fontFamily="monospace"
                fill={isHovered ? "rgba(110,231,247,0.65)" : "rgba(255,255,255,0.2)"}
                style={{ transition: "fill 150ms ease", userSelect: "none" }}
              >
                {node.id}
              </text>
            </g>
          );
        })}
      </svg>

      {/* ── Floating connection card ── */}
      {hoveredNodeId && hoveredNodeEdges.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: flipLeft ? mousePos.x - CARD_WIDTH - 12 : mousePos.x + 18,
            top: Math.max(8, Math.min(mousePos.y - 20, 560 - 300)),
            zIndex: 50,
            width: CARD_WIDTH,
            pointerEvents: "none",
          }}
        >
          <ConnectionTable
            edges={hoveredNodeEdges}
            onEdgeHighlight={onEdgeHighlight}
          />
        </div>
      )}
    </div>
  );
}
