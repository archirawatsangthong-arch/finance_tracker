import { RoundedBox } from '@react-three/drei';
import { useMemo, type Ref } from 'react';
import * as THREE from 'three';
import { GLBModel } from './GLBModel';
import { GlassMaterial } from './GlassMaterial';

const METAL = { color: '#a78bfa', metalness: 1, roughness: 0.2 } as const;

// ---------- แม่กุญแจแก้ว (ห่วงด้านบนยกขึ้นได้ = ปลดล็อก) ----------
function LockGeometry({ shackleRef }: { shackleRef?: Ref<THREE.Group> }) {
  return (
    <group>
      <RoundedBox args={[1.5, 1.2, 0.55]} radius={0.16} smoothness={4}>
        <GlassMaterial color="#c4b5fd" emissiveIntensity={0.05} />
      </RoundedBox>
      {/* รูกุญแจ */}
      <group position={[0, -0.05, 0.29]}>
        <mesh>
          <circleGeometry args={[0.13, 32]} />
          <meshStandardMaterial color="#2e1065" emissive="#8b5cf6" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[0, -0.17, 0]}>
          <planeGeometry args={[0.1, 0.24]} />
          <meshStandardMaterial color="#2e1065" emissive="#8b5cf6" emissiveIntensity={0.8} />
        </mesh>
      </group>
      {/* ห่วง (shackle) */}
      <group ref={shackleRef} position={[0, 0.6, 0]}>
        <group position={[0, 0.35, 0]}>
          <mesh>
            <torusGeometry args={[0.45, 0.09, 16, 48, Math.PI]} />
            <meshPhysicalMaterial {...METAL} clearcoat={1} />
          </mesh>
        </group>
        {[-0.45, 0.45].map((x) => (
          <mesh key={x} position={[x, 0.15, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.42, 20]} />
            <meshPhysicalMaterial {...METAL} clearcoat={1} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function Lock({ shackleRef }: { shackleRef?: Ref<THREE.Group> }) {
  return <GLBModel name="lock" fallback={<LockGeometry shackleRef={shackleRef} />} />;
}

// ---------- มือถือ (หน้าจอเรืองแสงพร้อม UI จำลอง) ----------
function PhoneGeometry() {
  const bars = useMemo(
    () => [
      { y: 0.62, w: 0.9, c: '#8b5cf6' },
      { y: 0.25, w: 1.1, c: '#34d399' },
      { y: 0.0, w: 0.75, c: '#f87171' },
      { y: -0.25, w: 0.95, c: '#f87171' },
      { y: -0.5, w: 0.6, c: '#34d399' },
    ],
    [],
  );
  return (
    <group>
      <RoundedBox args={[1.45, 2.8, 0.14]} radius={0.18} smoothness={4}>
        <meshPhysicalMaterial color="#1e1b2e" metalness={0.8} roughness={0.25} clearcoat={1} />
      </RoundedBox>
      {/* หน้าจอ */}
      <mesh position={[0, 0, 0.075]}>
        <planeGeometry args={[1.28, 2.6]} />
        <meshStandardMaterial color="#0f0b24" emissive="#1e1b4b" emissiveIntensity={0.9} />
      </mesh>
      {/* แถบยอดเงินด้านบน */}
      <mesh position={[0, 0.98, 0.08]}>
        <planeGeometry args={[1.1, 0.34]} />
        <meshStandardMaterial color="#4c1d95" emissive="#8b5cf6" emissiveIntensity={0.7} />
      </mesh>
      {bars.map((b) => (
        <mesh key={b.y} position={[-0.55 + b.w / 2, b.y, 0.08]}>
          <planeGeometry args={[b.w, 0.12]} />
          <meshStandardMaterial color={b.c} emissive={b.c} emissiveIntensity={0.6} transparent opacity={0.85} />
        </mesh>
      ))}
      {/* ปุ่ม + */}
      <mesh position={[0.38, -1.02, 0.08]}>
        <circleGeometry args={[0.15, 32]} />
        <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

export function Phone() {
  return <GLBModel name="phone" fallback={<PhoneGeometry />} />;
}

// ---------- กล่องหมวดหมู่ (แก้วสีเปิดด้านบน) ----------
export function CategoryBox({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, -0.36, 0]}>
        <boxGeometry args={[0.72, 0.05, 0.72]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      {[
        [0, 0, 0.36, 0],
        [0, 0, -0.36, 0],
        [0.36, 0, 0, Math.PI / 2],
        [-0.36, 0, 0, Math.PI / 2],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, r, 0]}>
          <boxGeometry args={[0.72, 0.72, 0.03]} />
          <meshPhysicalMaterial color={color} roughness={0.1} clearcoat={1} transparent opacity={0.32} depthWrite={false} emissive={color} emissiveIntensity={0.25} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- โล่ความปลอดภัย ----------
function ShieldGeometry() {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 1.25);
    s.bezierCurveTo(0.55, 1.05, 0.95, 1.05, 1.05, 1.0);
    s.bezierCurveTo(1.05, 0.1, 0.85, -0.75, 0, -1.3);
    s.bezierCurveTo(-0.85, -0.75, -1.05, 0.1, -1.05, 1.0);
    s.bezierCurveTo(-0.95, 1.05, -0.55, 1.05, 0, 1.25);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 6, curveSegments: 32 });
    g.center();
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={geo}>
        <meshPhysicalMaterial color="#7c3aed" metalness={1} roughness={0.18} clearcoat={1} clearcoatRoughness={0.1} />
      </mesh>
      <mesh geometry={geo} scale={[0.8, 0.8, 1.15]}>
        <GlassMaterial color="#c4b5fd" emissiveIntensity={0.08} />
      </mesh>
      {/* เครื่องหมายถูก */}
      <group position={[0, 0.02, 0.32]}>
        <mesh position={[-0.2, -0.08, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.36, 0.11, 0.08]} />
          <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={1.3} />
        </mesh>
        <mesh position={[0.15, 0.08, 0]} rotation={[0, 0, -Math.PI / 3.6]}>
          <boxGeometry args={[0.66, 0.11, 0.08]} />
          <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={1.3} />
        </mesh>
      </group>
    </group>
  );
}

export function Shield() {
  return <GLBModel name="shield" fallback={<ShieldGeometry />} />;
}
