import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useEnv';
import { useSettings, type Theme } from '../../store/settings';

/**
 * พื้นหลัง particles แบบ "ฝุ่นแสง" ลอยช้า ๆ ใช้ Canvas 2D
 * (เบากว่าเปิด WebGL context ที่สอง → ประหยัดแบตบนมือถือ)
 * หยุดวาดเมื่อแท็บถูกซ่อน และแสดงภาพนิ่งเมื่อ reduced motion
 */
export function ParticleBackground({ theme: forced }: { theme?: Theme } = {}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const userTheme = useSettings((s) => s.theme);
  // หน้า Landing บังคับธีมมืดเสมอ
  const theme = forced ?? userTheme;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;
    type P = { x: number; y: number; r: number; vx: number; vy: number; hue: number; a: number };
    let ps: P[] = [];

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // จำนวน particle ตามขนาดจอ (มือถือน้อยลง)
      const count = Math.round(Math.min(70, (w * h) / 22000));
      ps = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.05 - Math.random() * 0.15,
        hue: 230 + Math.random() * 60,
        a: 0.25 + Math.random() * 0.5,
      }));
    };

    const alpha = theme === 'dark' ? 1 : 0.5;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 90%, ${theme === 'dark' ? 75 : 55}%, ${p.a * alpha})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(50, now - last) / 16.67;
      last = now;
      for (const p of ps) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y < -5) {
          p.y = h + 5;
          p.x = Math.random() * w;
        }
        if (p.x < -5) p.x = w + 5;
        if (p.x > w + 5) p.x = -5;
      }
      draw();
      raf = requestAnimationFrame(loop);
    };

    resize();
    if (reduced) draw();
    else raf = requestAnimationFrame(loop);

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reduced, theme]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10" />;
}
