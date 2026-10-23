import { Suspense, useRef, type ReactNode } from 'react';
import { useSceneQuality } from './quality';
import { useInView } from './useInView';

interface Props {
  /** ฉาก 3D (lazy component) — ได้ paused=true เมื่อเลื่อนพ้นจอ */
  render: (paused: boolean) => ReactNode;
  /** ภาพนิ่งเมื่อไม่มี WebGL / ลดการเคลื่อนไหว / ระหว่างโหลด */
  fallback: ReactNode;
  className?: string;
}

/** โหลดฉาก 3D เมื่อใกล้เข้าจอครั้งแรก และหยุด render เมื่อออกนอกจอ */
export function SceneFrame({ render, fallback, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { mounted, visible } = useInView(ref);
  const q = useSceneQuality();
  return (
    <div ref={ref} className={`scene-fade ${className}`} aria-hidden>
      {q.enabled && mounted ? <Suspense fallback={fallback}>{render(!visible)}</Suspense> : fallback}
    </div>
  );
}
