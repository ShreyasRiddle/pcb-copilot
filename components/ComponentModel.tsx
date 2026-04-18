"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, Html } from "@react-three/drei";
import * as THREE from "three";
import { SceneComponent } from "@/lib/types";

interface ComponentModelProps extends SceneComponent {
  isSelected: boolean;
  onSelect: (c: SceneComponent) => void;
}

function ResistorMesh({ hovered, selected }: { hovered: boolean; selected: boolean }) {
  return (
    <group>
      {/* Body */}
      <mesh>
        <cylinderGeometry args={[0.12, 0.12, 0.55, 12]} />
        <meshStandardMaterial
          color="#8B5E3C"
          emissive={selected ? "#00ccff" : hovered ? "#ff6600" : "#000000"}
          emissiveIntensity={selected ? 0.8 : hovered ? 0.5 : 0}
          metalness={0.1}
          roughness={0.7}
        />
      </mesh>
      {/* Color bands */}
      {[-0.12, 0, 0.12].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.05, 12]} />
          <meshStandardMaterial color={["#ffcc00", "#222222", "#d44"][i]} />
        </mesh>
      ))}
      {/* Leads */}
      {[-1, 1].map((side, i) => (
        <mesh key={i} position={[0, side * 0.38, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.25, 6]} />
          <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function CapacitorCeramicMesh({ hovered, selected }: { hovered: boolean; selected: boolean }) {
  return (
    <mesh>
      <boxGeometry args={[0.35, 0.18, 0.55]} />
      <meshStandardMaterial
        color="#d4a017"
        emissive={selected ? "#00ccff" : hovered ? "#ff9900" : "#000000"}
        emissiveIntensity={selected ? 0.8 : hovered ? 0.4 : 0}
        metalness={0.1}
        roughness={0.6}
      />
    </mesh>
  );
}

function CapacitorElectrolyticMesh({ hovered, selected }: { hovered: boolean; selected: boolean }) {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.2, 0.2, 0.6, 16]} />
        <meshStandardMaterial
          color="#1a1a1a"
          emissive={selected ? "#00ccff" : hovered ? "#ff6600" : "#000000"}
          emissiveIntensity={selected ? 0.8 : hovered ? 0.4 : 0}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>
      {/* Stripe */}
      <mesh position={[-0.1, 0.15, 0]}>
        <boxGeometry args={[0.05, 0.5, 0.38]} />
        <meshStandardMaterial color="#eeeeee" />
      </mesh>
    </group>
  );
}

function InductorMesh({ hovered, selected }: { hovered: boolean; selected: boolean }) {
  return (
    <mesh>
      <boxGeometry args={[0.6, 0.35, 0.6]} />
      <meshStandardMaterial
        color="#5a5a6a"
        emissive={selected ? "#00ccff" : hovered ? "#8888ff" : "#000000"}
        emissiveIntensity={selected ? 0.8 : hovered ? 0.4 : 0}
        metalness={0.5}
        roughness={0.4}
      />
    </mesh>
  );
}

function ICMesh({ hovered, selected }: { hovered: boolean; selected: boolean }) {
  return (
    <group>
      {/* Body */}
      <mesh>
        <boxGeometry args={[1.4, 0.22, 0.9]} />
        <meshStandardMaterial
          color="#1a1a2e"
          emissive={selected ? "#00ccff" : hovered ? "#4444ff" : "#000000"}
          emissiveIntensity={selected ? 1.0 : hovered ? 0.5 : 0}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
      {/* Pin lines on sides */}
      {[-2, -1, 0, 1, 2].map((i) => (
        <mesh key={i} position={[i * 0.22, 0, 0.47]}>
          <boxGeometry args={[0.08, 0.08, 0.12]} />
          <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
      {[-2, -1, 0, 1, 2].map((i) => (
        <mesh key={i} position={[i * 0.22, 0, -0.47]}>
          <boxGeometry args={[0.08, 0.08, 0.12]} />
          <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

export default function ComponentModel(props: ComponentModelProps) {
  const { id, type, value, position, reasoning, isSelected, onSelect, ...rest } = props;
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);

  // Rotate resistors to lay flat horizontally
  const groupRotation: [number, number, number] =
    type === "resistor" ? [0, 0, Math.PI / 2] : [0, 0, 0];

  const handlePointerEnter = () => {
    setHovered(true);
    document.body.style.cursor = "pointer";
  };
  const handlePointerLeave = () => {
    setHovered(false);
    document.body.style.cursor = "default";
  };
  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect(props);
  };

  const meshProps = { hovered, selected: isSelected };

  const inner = (
    <group
      ref={groupRef}
      position={position}
      rotation={groupRotation}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
    >
      {type === "resistor" && <ResistorMesh {...meshProps} />}
      {type === "capacitor_ceramic" && <CapacitorCeramicMesh {...meshProps} />}
      {type === "capacitor_electrolytic" && <CapacitorElectrolyticMesh {...meshProps} />}
      {type === "inductor" && <InductorMesh {...meshProps} />}
      {type === "ic" && <ICMesh {...meshProps} />}

      {/* Worldspace annotation — always visible on hover or select */}
      {(hovered || isSelected) && (
        <Html
          position={[0, type === "ic" ? 0.8 : 0.55, 0]}
          distanceFactor={6}
          occlude={false}
          style={{ pointerEvents: "none" }}
        >
          <div className="annotation-card">
            <div className="label-type">{id} · {type.replace("_", " ")}</div>
            <div className="label-value">{value}</div>
            {reasoning && <div className="label-reason">{reasoning}</div>}
          </div>
        </Html>
      )}
    </group>
  );

  if (isSelected) {
    return (
      <Float speed={2} floatIntensity={0.25} floatingRange={[-0.08, 0.08]}>
        {inner}
      </Float>
    );
  }

  return inner;
}
