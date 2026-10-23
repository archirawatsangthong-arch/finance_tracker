import { useGLTF } from '@react-three/drei';
import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';

// ===== โหลดโมเดล .glb จาก /public/models ถ้ามี — ไม่มีหรือโหลดพังจะใช้ geometry พื้นฐานแทน =====
// วางไฟล์เช่น public/models/piggy.glb แล้วโมเดลจะถูกใช้แทนทันที (ไม่ต้องแก้โค้ด)
// หมายเหตุ: ปิด Draco ไว้ (ค่าเริ่มต้นของ drei โหลด decoder จาก CDN ซึ่งใช้ออฟไลน์ไม่ได้)

const availability = new Map<string, Promise<boolean>>();

/** เช็กว่าไฟล์มีจริงก่อนโหลด — dev server/PWA ตอบ index.html (200) แทน 404 จึงต้องดู content-type ด้วย */
function checkModel(url: string): Promise<boolean> {
  let p = availability.get(url);
  if (!p) {
    p = fetch(url, { method: 'HEAD' })
      .then((r) => r.ok && !(r.headers.get('content-type') ?? '').includes('text/html'))
      .catch(() => false);
    availability.set(url, p);
  }
  return p;
}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Loaded({ url, scale }: { url: string; scale: number }) {
  const { scene } = useGLTF(url, false);
  // clone เพื่อใช้โมเดลเดียวกันได้หลายที่ในฉากเดียว
  const object = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={object} scale={scale} />;
}

interface Props {
  /** ชื่อไฟล์ใน /public/models เช่น "piggy" → /models/piggy.glb */
  name: string;
  /** geometry ที่ใช้เมื่อไม่มีไฟล์ */
  fallback: ReactNode;
  scale?: number;
}

export function GLBModel({ name, fallback, scale = 1 }: Props) {
  const url = `/models/${name}.glb`;
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void checkModel(url).then((v) => alive && setOk(v));
    return () => {
      alive = false;
    };
  }, [url]);

  if (!ok) return <>{fallback}</>;
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Loaded url={url} scale={scale} />
      </Suspense>
    </ModelBoundary>
  );
}
