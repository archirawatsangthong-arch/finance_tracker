import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { Coin } from './Coin';
import { Lightformers } from './Lightformers';

const DURATION = 1.5;

/** กระปุกแก้ว + เหรียญหล่นลงพร้อมเด้งเล็กน้อย */
function Drop({ onDone }: { onDone: () => void }) {
  const coin = useRef<THREE.Group>(null);
  const jar = useRef<THREE.Group>(null);
  const t = useRef(0);
  const done = useRef(false);

  useFrame((_, delta) => {
    t.current += Math.min(delta, 0.05);
    const p = t.current / DURATION;
    if (coin.current) {
      // 0–0.55: หล่นแบบเร่งความเร็ว, หลังจากนั้นจมลงในกระปุกแล้วหายไป
      const fall = Math.min(1, p / 0.55);
      coin.current.position.y = THREE.MathUtils.lerp(2.4, 0.15, fall * fall) - Math.max(0, p - 0.55) * 1.2;
      coin.current.rotation.x += delta * 9;
      coin.current.scale.setScalar(Math.max(0, 0.45 * (1 - Math.max(0, p - 0.7) * 3)));
    }
    if (jar.current) {
      // กระปุกเด้ง (squash & stretch) ตอนเหรียญตกถึง
      const hit = Math.max(0, p - 0.55);
      const s = 1 + Math.sin(hit * 22) * Math.exp(-hit * 9) * 0.12;
      jar.current.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
    }
    if (p >= 1 && !done.current) {
      done.current = true;
      onDone();
    }
  });

  return (
    <>
      <group ref={coin} position={[0, 2.4, 0]}>
        <Coin segments={40} />
      </group>
      <group ref={jar} position={[0, -0.6, 0]}>
        {/* ตัวกระปุกแก้ว */}
        <mesh>
          <sphereGeometry args={[0.95, 48, 32]} />
          <meshPhysicalMaterial color="#c4b5fd" transmission={0.92} roughness={0.08} thickness={0.6} ior={1.4} transparent opacity={0.85} />
        </mesh>
        {/* ปากกระปุก */}
        <mesh position={[0, 0.9, 0]}>
          <torusGeometry args={[0.35, 0.07, 16, 48]} />
          <meshStandardMaterial color="#8b5cf6" metalness={1} roughness={0.2} />
        </mesh>
        {/* เหรียญด้านในกระปุก */}
        {[[-0.3, -0.55, 0.1], [0.25, -0.6, -0.15], [0, -0.5, 0.3]].map((pos, i) => (
          <group key={i} position={pos as [number, number, number]} rotation={[1.2 + i, i, 0]} scale={0.3}>
            <Coin segments={24} />
          </group>
        ))}
      </group>
    </>
  );
}

/** overlay อนิเมชันเหรียญหล่นลงกระปุก แสดงหลังบันทึกรายการสำเร็จ */
export default function CoinDropScene({ onDone }: { onDone: () => void }) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.4, 5.5], fov: 35 }} gl={{ alpha: true }} aria-hidden>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 4, 3]} intensity={1.4} />
      <Drop onDone={onDone} />
      <Lightformers resolution={128} />
    </Canvas>
  );
}
