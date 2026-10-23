import { ContactShadows, Float, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useUI } from '../../store/ui';
import { Coin } from './Coin';
import { Lightformers } from './Lightformers';

/** เหรียญหลัก: หมุนช้า ๆ + เอียงตามเมาส์ (parallax) + หมุนตีลังกาเมื่อบันทึกสำเร็จ */
function HeroCoin() {
  const group = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const flip = useRef(0);
  const celebrate = useUI((s) => s.celebrate);

  useEffect(() => {
    if (celebrate > 0) flip.current = Math.PI * 4;
  }, [celebrate]);

  useFrame((state, delta) => {
    if (!group.current || !spin.current) return;
    const dt = Math.min(delta, 0.05);
    // หมุนรอบแกน Y ช้า ๆ และเร่งตอนฉลอง
    const boost = flip.current * 4 * dt;
    flip.current = Math.max(0, flip.current - boost);
    spin.current.rotation.y += dt * 0.5 + boost;
    // parallax: ใช้ pointer ที่ normalize แล้ว (-1..1) แบบหน่วงนุ่ม ๆ
    const { x, y } = state.pointer;
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -y * 0.35, 4, dt);
    group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, -x * 0.2, 4, dt);
    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, x * 0.25, 3, dt);
  });

  return (
    <group ref={group}>
      <Float speed={1.6} rotationIntensity={0.25} floatIntensity={0.8} floatingRange={[-0.08, 0.08]}>
        <group ref={spin} rotation={[0.25, 0, 0]}>
          <Coin radius={1.05} thickness={0.2} />
        </group>
      </Float>
    </group>
  );
}

/** เหรียญเล็ก ๆ ลอยรอบ ๆ เพิ่มมิติ */
function Satellites() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.25;
  });
  return (
    <group ref={ref}>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <Float key={i} speed={2 + i * 0.4} floatIntensity={1.2} rotationIntensity={1.5}>
            <group position={[Math.cos(a) * 1.9, Math.sin(a * 2) * 0.4, Math.sin(a) * 1.9]} rotation={[a, a, 0]} scale={0.22}>
              <Coin segments={32} />
            </group>
          </Float>
        );
      })}
    </group>
  );
}

/** Hero 3D ของหน้า Dashboard — ลด dpr อัตโนมัติถ้า fps ตก */
export default function HeroScene({ paused = false }: { paused?: boolean }) {
  const [dpr, setDpr] = useState(1.5);
  return (
    <Canvas
      dpr={[1, dpr]}
      frameloop={paused ? 'never' : 'always'}
      camera={{ position: [0, 0, 5], fov: 35 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      eventSource={document.getElementById('root') ?? undefined}
      eventPrefix="client"
      aria-hidden
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.75)} flipflops={3} onFallback={() => setDpr(1)} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} />
      <HeroCoin />
      <Satellites />
      <ContactShadows position={[0, -1.5, 0]} opacity={0.45} scale={6} blur={2.6} far={3} resolution={256} frames={Infinity} color="#4c1d95" />
      <Lightformers />
    </Canvas>
  );
}
