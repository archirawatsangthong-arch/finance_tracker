import { PresentationControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { CategorySlice } from '../../lib/stats';
import { Lightformers } from './Lightformers';

interface Props {
  data: CategorySlice[];
  active: number | null;
  onHover: (i: number | null) => void;
}

/** ชิ้นโดนัท 1 ชิ้น = TorusGeometry ที่มี arc เท่ากับสัดส่วน — ชิ้นที่ active จะยื่นออกและสูงขึ้น */
function Slice({ start, arc, color, index, active, onHover }: { start: number; arc: number; color: string; index: number; active: boolean; onHover: Props['onHover'] }) {
  const ref = useRef<THREE.Mesh>(null);
  // เว้นช่องว่างระหว่างชิ้นเล็กน้อย
  const gap = Math.min(0.03, arc * 0.15);
  const geo = useMemo(() => new THREE.TorusGeometry(1.15, 0.38, 24, Math.max(8, Math.ceil(arc * 24)), Math.max(0.01, arc - gap)), [arc, gap]);
  const mid = start + arc / 2;

  useFrame((_, d) => {
    if (!ref.current) return;
    const target = active ? 0.18 : 0;
    ref.current.position.x = THREE.MathUtils.damp(ref.current.position.x, Math.cos(mid) * target, 8, d);
    ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, Math.sin(mid) * target, 8, d);
    ref.current.position.z = THREE.MathUtils.damp(ref.current.position.z, active ? 0.12 : 0, 8, d);
  });

  return (
    <mesh
      ref={ref}
      geometry={geo}
      rotation={[0, 0, start + gap / 2]}
      scale={[1, 1, 0.55]}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(index);
      }}
      onPointerOut={() => onHover(null)}
    >
      <meshPhysicalMaterial color={color} metalness={0.35} roughness={0.25} clearcoat={1} clearcoatRoughness={0.2} emissive={color} emissiveIntensity={active ? 0.35 : 0.08} />
    </mesh>
  );
}

function Donut({ data, active, onHover }: Props) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    if (group.current && active === null) group.current.rotation.z += d * 0.15;
  });
  const total = data.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  return (
    <group ref={group}>
      {data.map((s, i) => {
        const arc = (s.value / total) * Math.PI * 2;
        const start = acc;
        acc += arc;
        return <Slice key={s.category.id} start={start} arc={arc} color={s.category.color} index={i} active={active === i} onHover={onHover} />;
      })}
    </group>
  );
}

/** กราฟโดนัท 3D หมุนได้ (ลากเพื่อหมุน) */
export default function Donut3D(props: Props) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, -2.2, 4.6], fov: 40 }} gl={{ alpha: true, antialias: true }} aria-hidden>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, -2, 5]} intensity={1.2} />
      <PresentationControls global={false} cursor snap speed={1.4} polar={[-0.6, 0.6]} azimuth={[-0.8, 0.8]} rotation={[0.15, 0, 0]}>
        <Donut {...props} />
      </PresentationControls>
      <Lightformers resolution={128} />
    </Canvas>
  );
}
