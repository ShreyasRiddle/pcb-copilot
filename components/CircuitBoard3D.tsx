"use client";

import { useRef, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import ComponentModel from "./ComponentModel";
import PCBBoard from "./PCBBoard";
import { SceneComponent } from "@/lib/types";

interface CameraRigProps {
  target: THREE.Vector3 | null;
}

function CameraRig({ target }: CameraRigProps) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useFrame(() => {
    if (!target || !controlsRef.current) return;
    const offset = new THREE.Vector3(3, 3.5, 3);
    const desiredPos = target.clone().add(offset);
    camera.position.lerp(desiredPos, 0.04);
    (controlsRef.current.target as THREE.Vector3).lerp(target, 0.04);
    controlsRef.current.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.06}
      minDistance={3}
      maxDistance={22}
      maxPolarAngle={Math.PI / 2.1}
    />
  );
}

interface CircuitBoard3DProps {
  components: SceneComponent[];
  traces: [string, string][];
  onSelect: (c: SceneComponent | null) => void;
  selected: SceneComponent | null;
}

export default function CircuitBoard3D({
  components,
  traces,
  onSelect,
  selected,
}: CircuitBoard3DProps) {
  const focusTarget = selected
    ? new THREE.Vector3(...selected.position)
    : null;

  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ position: [0, 10, 12], fov: 42 }}
      gl={{ antialias: true, alpha: false }}
      style={{ position: "absolute", inset: 0, background: "#0a0a0f" }}
      onPointerMissed={() => onSelect(null)}
    >
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-5, 4, -4]} intensity={0.5} color="#2244ff" />
      <pointLight position={[5, 4, 4]} intensity={0.3} color="#00ffcc" />

      <Environment preset="studio" />

      <PCBBoard traces={traces} components={components} />

      {components.map((c) => (
        <ComponentModel
          key={c.id}
          {...c}
          isSelected={selected?.id === c.id}
          onSelect={onSelect}
        />
      ))}

      <CameraRig target={focusTarget} />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.15}
          luminanceSmoothing={0.9}
          intensity={1.2}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
}
