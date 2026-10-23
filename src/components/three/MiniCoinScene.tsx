import { Float } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { Coin } from './Coin';
import { Lightformers } from './Lightformers';

function Spinner() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.8;
  });
  return (
    <Float speed={2} floatIntensity={1}>
      <group ref={ref} rotation={[0.3, 0, 0]}>
        <Coin segments={48} />
      </group>
    </Float>
  );
}

/** เหรียญ 3D ขนาดเล็กสำหรับ empty state */
export default function MiniCoinScene() {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 4], fov: 35 }} gl={{ alpha: true }} aria-hidden>
      <ambientLight intensity={0.4} />
      <Spinner />
      <Lightformers resolution={128} />
    </Canvas>
  );
}
