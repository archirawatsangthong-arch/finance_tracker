import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion';
import type { PointerEvent, ReactNode } from 'react';
import { useHoverCapable, useReducedMotion } from '../../hooks/useEnv';

interface Props {
  children: ReactNode;
  className?: string;
  /** องศาเอียงสูงสุด */
  max?: number;
}

/** การ์ดที่เอียง 3D ตามเมาส์ พร้อมแสงสะท้อน (ปิดเองบนจอสัมผัสและ reduced motion) */
export function TiltCard({ children, className = '', max = 8 }: Props) {
  const reduced = useReducedMotion();
  const hover = useHoverCapable();
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const sx = useSpring(x, { stiffness: 200, damping: 20 });
  const sy = useSpring(y, { stiffness: 200, damping: 20 });
  const rotateX = useTransform(sy, [0, 1], [max, -max]);
  const rotateY = useTransform(sx, [0, 1], [-max, max]);
  const gx = useTransform(sx, (v) => `${v * 100}%`);
  const gy = useTransform(sy, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(240px circle at ${gx} ${gy}, rgb(255 255 255 / 0.10), transparent 60%)`;

  if (reduced || !hover) return <div className={`glass rounded-2xl ${className}`}>{children}</div>;

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width);
    y.set((e.clientY - r.top) / r.height);
  };
  const reset = () => {
    x.set(0.5);
    y.set(0.5);
  };

  return (
    <div style={{ perspective: 900 }}>
      <motion.div
        onPointerMove={onMove}
        onPointerLeave={reset}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        whileHover={{ scale: 1.015 }}
        className={`glass relative rounded-2xl ${className}`}
      >
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: glare }} />
        <div style={{ transform: 'translateZ(24px)' }}>{children}</div>
      </motion.div>
    </div>
  );
}
