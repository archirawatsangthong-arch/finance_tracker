import { ContactShadows, Float } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Coin } from '../three/Coin';
import LandingCanvas from './LandingCanvas';
import { Piggy } from './models/Piggy';
import { useSceneQuality } from './quality';

const TINTS = [undefined, '#34D399', undefined, '#F59E0B', undefined, '#3B82F6', undefined, '#EC4899'];

/** เหรียญหลายเหรียญลอยวนรอบกระปุกเป็นวงรีเอียง แต่ละเหรียญหมุนตัวเอง */
function OrbitCoins({ count }: { count: number }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const seeds = useMemo(
    () => Array.from({ length: count }, (_, i) => ({ phase: (i / count) * Math.PI * 2, radius: 2.1 + (i % 3) * 0.28, speed: 0.32 + (i % 4) * 0.04, tilt: 0.35 + (i % 2) * 0.12 })),
    [count],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    seeds.forEach((s, i) => {
      const g = refs.current[i];
      if (!g) return;
      const a = s.phase + t * s.speed;
      g.position.set(Math.cos(a) * s.radius, Math.sin(a) * s.radius * s.tilt * 0.6 + Math.sin(t + i) * 0.08, Math.sin(a) * s.radius * 0.55);
      g.rotation.set(t * 0.9 + i, t * 1.3 + i * 0.5, 0);
    });
  });
  return (
    <>
      {seeds.map((_, i) => (
        <group key={i} ref={(el) => void (refs.current[i] = el)} scale={0.3}>
          <Coin segments={32} tint={TINTS[i % TINTS.length]} />
        </group>
      ))}
    </>
  );
}

/** กระปุกหลัก: ลอยขึ้นลง + เอียงตามเมาส์ (parallax) */
function Hero() {
  const group = useRef<THREE.Group>(null);
  const q = useSceneQuality();
  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    const { x, y } = state.pointer;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, -0.55 + x * 0.45, 3, dt);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, 0.12 - y * 0.25, 3, dt);
    g.position.x = THREE.MathUtils.damp(g.position.x, x * 0.25, 2.5, dt);
    g.position.y = THREE.MathUtils.damp(g.position.y, y * 0.15, 2.5, dt);
  });
  return (
    <group ref={group}>
      <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.6} floatingRange={[-0.08, 0.08]}>
        <Piggy />
      </Float>
      <OrbitCoins count={q.mobile ? 5 : 8} />
    </group>
  );
}

/** ฉาก Hero ของ Landing: กระปุกออมสินแก้ว + เหรียญลอยวนรอบ + bloom เบา ๆ */
export default function HeroScene({ paused }: { paused: boolean }) {
  return (
    <LandingCanvas paused={paused} camera={{ position: [0, 0.4, 7.2], fov: 38 }}>
      <Hero />
      <ContactShadows position={[0, -1.6, 0]} opacity={0.4} scale={8} blur={2.8} far={3} resolution={256} color="#4c1d95" />
    </LandingCanvas>
  );
}
