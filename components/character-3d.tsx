"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, RoundedBox } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

type CharacterKind = "bellwether" | "scout" | "flux" | "split" | "receipt";
type CharacterState = "idle" | "observing" | "aligned" | "uncertain" | "blocked" | "ready" | "confirmed";

const palette: Record<CharacterKind, { body: string; glow: string; detail: string }> = {
  bellwether: { body: "#9945ff", glow: "#14f195", detail: "#f5f0ff" },
  scout: { body: "#14f195", glow: "#9945ff", detail: "#08111f" },
  flux: { body: "#31d7e8", glow: "#9945ff", detail: "#08111f" },
  split: { body: "#ffb86b", glow: "#9945ff", detail: "#21112c" },
  receipt: { body: "#f5f0ff", glow: "#14f195", detail: "#9945ff" },
};

function Sentinel({ kind, state }: { kind: CharacterKind; state: CharacterState }) {
  const group = useRef<THREE.Group>(null);
  const colors = palette[kind];
  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * (state === "observing" ? 0.28 : 0.08);
    group.current.position.y = Math.sin(Date.now() * 0.0012) * (state === "idle" ? 0.035 : 0.065);
  });

  return (
    <group ref={group} rotation={[0, -0.2, 0]}>
      <Float speed={state === "observing" ? 2 : 1.1} rotationIntensity={0.15} floatIntensity={0.35}>
        <mesh position={[0, -0.1, 0]} castShadow>
          <icosahedronGeometry args={[0.88, 1]} />
          <meshStandardMaterial color={colors.body} roughness={0.28} metalness={0.48} flatShading />
        </mesh>
        <RoundedBox args={[1.18, 0.52, 0.2]} radius={0.08} smoothness={3} position={[0, 0.05, 0.77]} castShadow>
          <meshStandardMaterial color={colors.detail} roughness={0.2} metalness={0.25} />
        </RoundedBox>
        <mesh position={[-0.24, 0.05, 0.9]}>
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshStandardMaterial color="#08111f" emissive="#08111f" emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[0.24, 0.05, 0.9]}>
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshStandardMaterial color="#08111f" emissive="#08111f" emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[0, 0.96, 0]} rotation={[0, 0, 0.25]}>
          <cylinderGeometry args={[0.035, 0.035, 0.38, 10]} />
          <meshStandardMaterial color={colors.detail} metalness={0.65} roughness={0.18} />
        </mesh>
        <mesh position={[0.1, 1.18, 0]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color={colors.glow} emissive={colors.glow} emissiveIntensity={state === "uncertain" ? 0.6 : 1.8} />
        </mesh>
        <mesh position={[0, -1.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.66, 0.025, 8, 48]} />
          <meshStandardMaterial color={colors.glow} emissive={colors.glow} emissiveIntensity={0.5} transparent opacity={0.8} />
        </mesh>
        {kind === "scout" && <mesh position={[0.72, 0.1, 0.2]} rotation={[0.3, 0.2, -0.4]}><coneGeometry args={[0.22, 0.7, 4]} /><meshStandardMaterial color={colors.glow} metalness={0.35} roughness={0.2} /></mesh>}
        {kind === "flux" && <mesh position={[0, -0.75, 0.4]} rotation={[0.2, 0, 0]}><torusGeometry args={[0.34, 0.12, 12, 32]} /><meshStandardMaterial color={colors.glow} transparent opacity={0.75} emissive={colors.glow} emissiveIntensity={0.35} /></mesh>}
        {kind === "split" && <mesh position={[0, 0.05, 0.92]}><boxGeometry args={[0.05, 0.35, 0.05]} /><meshStandardMaterial color={colors.glow} emissive={colors.glow} emissiveIntensity={0.9} /></mesh>}
        {kind === "receipt" && <mesh position={[0, -0.05, 0.9]}><boxGeometry args={[0.62, 0.05, 0.03]} /><meshStandardMaterial color={colors.glow} emissive={colors.glow} emissiveIntensity={0.8} /></mesh>}
      </Float>
    </group>
  );
}

export function Character3D({ kind = "bellwether", state = "idle", className = "" }: { kind?: CharacterKind; state?: CharacterState; className?: string }) {
  return (
    <div className={`character-3d character-3d--${kind} ${className}`} aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 4.1], fov: 34 }} dpr={[1, 1.6]} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={1.4} />
        <directionalLight position={[3, 4, 5]} intensity={3.2} color="#ffffff" castShadow />
        <pointLight position={[-3, 1, 3]} intensity={6} color={palette[kind].glow} distance={6} />
        <Sentinel kind={kind} state={state} />
      </Canvas>
    </div>
  );
}
