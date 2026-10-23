import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { hasWebGL, useReducedMotion } from '../../hooks/useEnv';
import { StaticCoin } from './StaticCoin';

// lazy load: three.js ถูกแยก chunk และโหลดเมื่อ hero ปรากฏบนจอเท่านั้น
const HeroScene = lazy(() => import('./HeroScene'));

export function Hero3D({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // โหลด 3D เมื่อเห็นบนจอครั้งแรก และหยุด render เมื่อเลื่อนพ้นจอ เพื่อประหยัดแบต
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (e.isIntersecting) setMounted(true);
      },
      { rootMargin: '100px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const use3D = hasWebGL() && !reduced;
  const fallback = <StaticCoin className="h-full w-full p-6" />;

  return (
    <div ref={ref} className={className}>
      {use3D && mounted ? <Suspense fallback={fallback}><HeroScene paused={!visible} /></Suspense> : fallback}
    </div>
  );
}
