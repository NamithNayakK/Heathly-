/**
 * HeroScene.jsx — Lazy-loaded Three.js particle-wave orb
 * Reacts subtly to mouse position (parallax tilt, NOT aggressive).
 * Wrapped in Suspense at call-site with a CSS fallback.
 */
import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial, MeshDistortMaterial, Sphere } from "@react-three/drei";
import * as THREE from "three";

function ParticleField({ mouse }) {
  const ref = useRef();
  const count = 1400;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Distribute in a sphere
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 1.6 + Math.random() * 0.8;
      arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    // Slow breath rotation
    ref.current.rotation.y = t * 0.06 + mouse.current.x * 0.15;
    ref.current.rotation.x = t * 0.03 + mouse.current.y * 0.08;
  });

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#5EEAD4"
        size={0.018}
        sizeAttenuation
        depthWrite={false}
        opacity={0.65}
      />
    </Points>
  );
}

function GlassOrb({ mouse }) {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    // Gentle breathing scale
    ref.current.scale.setScalar(1 + Math.sin(t * 0.5) * 0.04);
    // Subtle tilt toward mouse
    ref.current.rotation.y = mouse.current.x * 0.2;
    ref.current.rotation.x = mouse.current.y * 0.1;
  });

  return (
    <Sphere ref={ref} args={[1, 64, 64]}>
      <MeshDistortMaterial
        color="#A78BFA"
        attach="material"
        distort={0.35}
        speed={1.2}
        roughness={0.1}
        metalness={0.1}
        transparent
        opacity={0.18}
        wireframe={false}
      />
    </Sphere>
  );
}

function InnerGlow({ mouse }) {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.scale.setScalar(0.55 + Math.sin(t * 0.7 + 1) * 0.06);
  });
  return (
    <Sphere ref={ref} args={[1, 32, 32]}>
      <meshBasicMaterial color="#5EEAD4" transparent opacity={0.06} />
    </Sphere>
  );
}

export default function HeroScene() {
  const mouse = useRef({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
    mouse.current.y = ((e.clientY - rect.top)  / rect.height - 0.5) * -2;
  };

  return (
    <div
      style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
      onMouseMove={handleMouseMove}
    >
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[4, 4, 4]} intensity={1.2} color="#5EEAD4" />
        <pointLight position={[-4, -2, -4]} intensity={0.6} color="#A78BFA" />
        <InnerGlow mouse={mouse} />
        <GlassOrb mouse={mouse} />
        <ParticleField mouse={mouse} />
      </Canvas>
    </div>
  );
}
