"use client";

import { useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { EffectComposer, Bloom, DepthOfField } from "@react-three/postprocessing";
import * as THREE from "three";
import ComponentModel from "./ComponentModel";
import PCBBoard from "./PCBBoard";
import CanvasErrorBoundary from "./CanvasErrorBoundary";
import { SceneComponent } from "@/lib/types";

const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 10, 12);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);

interface CameraRigProps {
  target: THREE.Vector3 | null;
}

function CameraRig({ target }: CameraRigProps) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useFrame(() => {
    if (!controlsRef.current) return;

    if (target) {
      // Focus on selected component
      const offset = new THREE.Vector3(3, 3.5, 3);
      const desiredPos = target.clone().add(offset);
      camera.position.lerp(desiredPos, 0.04);
      (controlsRef.current.target as THREE.Vector3).lerp(target, 0.04);
    } else {
      // Pull back to default overview
      camera.position.lerp(DEFAULT_CAMERA_POS, 0.03);
      (controlsRef.current.target as THREE.Vector3).lerp(DEFAULT_TARGET, 0.03);
    }

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
  highlightedId?: string | null;
}

export default function CircuitBoard3D({
  components, traces, onSelect, selected, highlightedId,
}: CircuitBoard3DProps) {
  const focusTarget = selected
    ? new THREE.Vector3(...selected.position)
    : highlightedId
    ? (() => {
        const c = components.find((x) => x.id === highlightedId);
        return c ? new THREE.Vector3(...c.position) : null;
      })()
    : null;

  return (
    <CanvasErrorBoundary>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ position: [0, 10, 12], fov: 42 }}
        gl={{ antialias: true, alpha: false }}
        style={{ position: "absolute", inset: 0, background: "#0a0a0f" }}
        onPointerMissed={() => onSelect(null)}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} />
        <pointLight position={[-5, 4, -4]} intensity={0.5} color="#2244ff" />
        <pointLight position={[5, 4, 4]} intensity={0.3} color="#00ffcc" />

        <Environment preset="studio" />

        <PCBBoard traces={traces} components={components} />

        {components.map((c) => (
          <ComponentModel
            key={c.id}
            {...c}
            isSelected={selected?.id === c.id}
            isHighlighted={highlightedId === c.id && selected?.id !== c.id}
            onSelect={onSelect}
          />
        ))}

        <CameraRig target={focusTarget} />

        <EffectComposer>
          <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.9} intensity={1.2} mipmapBlur />
          <DepthOfField
            focusDistance={focusTarget ? 0.008 : 0}
            focalLength={focusTarget ? 0.025 : 0}
            bokehScale={focusTarget ? 3 : 0}
            target={focusTarget ?? undefined}
          />
        </EffectComposer>
      </Canvas>
    </CanvasErrorBoundary>
  );
}
