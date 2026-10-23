import * as THREE from 'three';

// ===== เหรียญโลหะ: ใช้ texture / geometry / material ร่วมกันทุกเหรียญ =====
// (ฉาก tutorial มีเหรียญหลายสิบเหรียญ — สร้าง texture ครั้งเดียวประหยัดหน่วยความจำและเวลาโหลด)

let faceTexture: THREE.CanvasTexture | null = null;

/** texture รูป "฿" บนหน้าเหรียญ วาดด้วย canvas (ไม่ต้องโหลดไฟล์ภาพ) */
function getFaceTexture(): THREE.CanvasTexture {
  if (faceTexture) return faceTexture;
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size * 0.35, size * 0.3, 10, size / 2, size / 2, size * 0.6);
  g.addColorStop(0, '#f5f3ff');
  g.addColorStop(0.5, '#c4b5fd');
  g.addColorStop(1, '#7c3aed');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
  ctx.stroke();
  // ขีดเล็ก ๆ รอบขอบแบบเหรียญจริง
  ctx.lineWidth = 6;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(size / 2 + Math.cos(a) * size * 0.43, size / 2 + Math.sin(a) * size * 0.43);
    ctx.lineTo(size / 2 + Math.cos(a) * size * 0.47, size / 2 + Math.sin(a) * size * 0.47);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(76,29,149,0.6)';
  ctx.shadowBlur = 18;
  ctx.font = `bold ${size * 0.46}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('฿', size / 2, size / 2 + size * 0.02);
  faceTexture = new THREE.CanvasTexture(c);
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  faceTexture.anisotropy = 4;
  return faceTexture;
}

const geometries = new Map<string, THREE.CylinderGeometry>();

function getGeometry(radius: number, thickness: number, segments: number): THREE.CylinderGeometry {
  const key = `${radius}-${thickness}-${segments}`;
  let geo = geometries.get(key);
  if (!geo) {
    geo = new THREE.CylinderGeometry(radius, radius, thickness, segments, 1);
    geometries.set(key, geo);
  }
  return geo;
}

const materials = new Map<string, THREE.Material[]>();

/** material ของเหรียญ [ขอบ, หน้าบน, หน้าล่าง] — tint = สีหมวดหมู่ (ไม่ส่ง = ม่วงตามแบรนด์) */
export function getCoinMaterials(tint?: string): THREE.Material[] {
  const key = tint ?? 'brand';
  let mats = materials.get(key);
  if (!mats) {
    const face = new THREE.MeshPhysicalMaterial({
      map: getFaceTexture(),
      color: tint ? new THREE.Color(tint).lerp(new THREE.Color('#ffffff'), 0.35) : '#ffffff',
      metalness: 0.85,
      roughness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
    });
    const rim = new THREE.MeshPhysicalMaterial({ color: tint ?? '#8b5cf6', metalness: 1, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15 });
    mats = [rim, face, face];
    materials.set(key, mats);
  }
  return mats;
}

interface CoinProps {
  radius?: number;
  thickness?: number;
  segments?: number;
  /** สีของเหรียญ (เช่น สีหมวดหมู่) */
  tint?: string;
  /** material เฉพาะเหรียญนี้ (เช่น ต้องปรับ opacity ทีละเหรียญ) — ไม่ส่ง = ใช้ material ร่วมตาม tint */
  materials?: THREE.Material[];
}

/** เหรียญโลหะ: ขอบเป็น metallic, หน้าเหรียญมี texture ฿ */
export function Coin({ radius = 1, thickness = 0.18, segments = 64, tint, materials }: CoinProps) {
  // CylinderGeometry มี 3 group: [ขอบ, หน้าบน, หน้าล่าง] — หมุนให้หน้าเหรียญหันเข้ากล้อง
  return <mesh geometry={getGeometry(radius, thickness, segments)} material={materials ?? getCoinMaterials(tint)} rotation={[Math.PI / 2, 0, 0]} castShadow />;
}
