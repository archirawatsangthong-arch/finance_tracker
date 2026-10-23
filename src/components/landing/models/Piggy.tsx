import type { Ref } from 'react';
import type * as THREE from 'three';
import { Coin } from '../../three/Coin';
import { GLBModel } from './GLBModel';
import { GlassMaterial } from './GlassMaterial';

const METAL = { color: '#8b5cf6', metalness: 1, roughness: 0.22 } as const;

/** ตำแหน่งช่องหยอดเหรียญ (พิกัดของโมเดล) — ฉากใช้เป็นเป้าของเหรียญ/ป้ายที่พุ่งเข้ากระปุก */
export const PIGGY_SLOT: [number, number, number] = [-0.05, 0.99, 0];

interface Props {
  /** group ของกองเหรียญด้านใน — ฉากปรับ scale.y เพื่อแสดงว่ากระปุกเต็มแค่ไหน */
  fillRef?: Ref<THREE.Group>;
}

/** กระปุกออมสินแก้ว (geometry พื้นฐาน) — มีเหรียญกองอยู่ข้างในให้เห็นผ่านแก้ว */
function PiggyGeometry({ fillRef }: Props) {
  return (
    <group>
      {/* ตัวกระปุก */}
      <mesh scale={[1.25, 1, 1]}>
        <sphereGeometry args={[1, 48, 32]} />
        <GlassMaterial color="#c4b5fd" />
      </mesh>
      {/* กองเหรียญด้านใน (ยืดขึ้นตามความคืบหน้าการออม) */}
      <group position={[0, -0.75, 0]}>
        <group ref={fillRef} scale={[1, 0.35, 1]}>
          {[
            [-0.35, 0.15, 0.1, 0.4],
            [0.3, 0.2, -0.2, 1.1],
            [0, 0.35, 0.3, 2],
            [-0.15, 0.55, -0.25, 2.6],
            [0.4, 0.6, 0.15, 0.7],
            [0, 0.85, 0, 1.6],
            [-0.4, 0.95, 0.15, 2.2],
            [0.25, 1.15, -0.05, 0.3],
          ].map(([x, y, z, r], i) => (
            <group key={i} position={[x, y, z]} rotation={[1.3 + r * 0.2, r, 0]} scale={0.32}>
              <Coin segments={24} />
            </group>
          ))}
        </group>
      </group>
      {/* จมูก */}
      <group position={[1.28, -0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh>
          <cylinderGeometry args={[0.34, 0.36, 0.3, 32]} />
          <meshPhysicalMaterial {...METAL} clearcoat={1} />
        </mesh>
        {[-0.12, 0.12].map((z) => (
          <mesh key={z} position={[0, -0.16, z]}>
            <cylinderGeometry args={[0.06, 0.06, 0.02, 16]} />
            <meshStandardMaterial color="#2e1065" />
          </mesh>
        ))}
      </group>
      {/* ตา */}
      {[-0.38, 0.38].map((z) => (
        <mesh key={z} position={[0.98, 0.32, z]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color="#1e1b4b" metalness={0.4} roughness={0.2} />
        </mesh>
      ))}
      {/* หู (ทรงใบไม้แบน ๆ เอียงไปข้างหน้า) */}
      {[-0.42, 0.42].map((z) => (
        <mesh key={z} position={[0.66, 0.84, z]} rotation={[z > 0 ? -0.35 : 0.35, 0, -0.55]} scale={[0.2, 0.26, 0.07]}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshPhysicalMaterial {...METAL} clearcoat={1} />
        </mesh>
      ))}
      {/* ขา */}
      {[
        [0.6, 0.45],
        [0.6, -0.45],
        [-0.6, 0.45],
        [-0.6, -0.45],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, -0.95, z]}>
          <cylinderGeometry args={[0.16, 0.18, 0.32, 20]} />
          <meshPhysicalMaterial {...METAL} />
        </mesh>
      ))}
      {/* ช่องหยอดเหรียญ */}
      <mesh position={PIGGY_SLOT}>
        <boxGeometry args={[0.62, 0.05, 0.12]} />
        <meshStandardMaterial color="#1e1b4b" emissive="#a78bfa" emissiveIntensity={0.6} />
      </mesh>
      {/* หาง */}
      <mesh position={[-1.27, 0.2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.12, 0.035, 12, 32, Math.PI * 1.6]} />
        <meshPhysicalMaterial {...METAL} />
      </mesh>
    </group>
  );
}

/** กระปุกออมสิน — ใช้ /models/piggy.glb ถ้ามี ไม่งั้นใช้ geometry ด้านบน */
export function Piggy({ fillRef }: Props) {
  return <GLBModel name="piggy" fallback={<PiggyGeometry fillRef={fillRef} />} />;
}
