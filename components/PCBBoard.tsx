"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { SceneComponent } from "@/lib/types";

interface PCBBoardProps {
  traces: [string, string][];
  components: SceneComponent[];
}

function manhattanPath(
  a: [number, number, number],
  b: [number, number, number]
): THREE.Vector3[] {
  const mid = [(a[0] + b[0]) / 2, 0.05, a[2]] as [number, number, number];
  return [
    new THREE.Vector3(a[0], 0.05, a[2]),
    new THREE.Vector3(mid[0], mid[1], mid[2]),
    new THREE.Vector3(mid[0], 0.05, b[2]),
    new THREE.Vector3(b[0], 0.05, b[2]),
  ];
}

function AnimatedTrace({ points }: { points: THREE.Vector3[] }) {
  const ref = useRef<{ dashOffset: number }>({ dashOffset: 0 });

  useFrame((_, delta) => {
    ref.current.dashOffset -= delta * 0.8;
  });

  return (
    <Line
      points={points}
      color="#b87333"
      lineWidth={1.2}
      dashed
      dashSize={0.18}
      gapSize={0.12}
      dashOffset={ref.current.dashOffset}
      transparent
      opacity={0.7}
    />
  );
}

export default function PCBBoard({ traces, components }: PCBBoardProps) {
  const posMap = Object.fromEntries(components.map((c) => [c.id, c.position]));

  return (
    <group>
      {/* PCB plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial
          color="#1a3320"
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>

      {/* PCB edge highlight */}
      <lineSegments>
        <edgesGeometry
          args={[new THREE.BoxGeometry(14, 0.04, 10)]}
        />
        <lineBasicMaterial color="#2a5a38" />
      </lineSegments>

      {/* Copper grid lines (subtle) */}
      {Array.from({ length: 7 }, (_, i) => i - 3).map((i) => (
        <Line
          key={`v${i}`}
          points={[
            new THREE.Vector3(i * 2, 0.02, -4.8),
            new THREE.Vector3(i * 2, 0.02, 4.8),
          ]}
          color="#2a4a30"
          lineWidth={0.5}
          transparent
          opacity={0.4}
        />
      ))}
      {Array.from({ length: 5 }, (_, i) => i - 2).map((i) => (
        <Line
          key={`h${i}`}
          points={[
            new THREE.Vector3(-6.8, 0.02, i * 2),
            new THREE.Vector3(6.8, 0.02, i * 2),
          ]}
          color="#2a4a30"
          lineWidth={0.5}
          transparent
          opacity={0.4}
        />
      ))}

      {/* Copper traces */}
      {traces.map(([fromId, toId]) => {
        const a = posMap[fromId];
        const b = posMap[toId];
        if (!a || !b) return null;
        const pts = manhattanPath(a, b);
        return <AnimatedTrace key={`${fromId}-${toId}`} points={pts} />;
      })}
    </group>
  );
}
