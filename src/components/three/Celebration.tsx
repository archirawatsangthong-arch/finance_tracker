import { AnimatePresence, motion } from 'framer-motion';
import { lazy, Suspense, useEffect, useState } from 'react';
import { hasWebGL, useReducedMotion } from '../../hooks/useEnv';
import { useUI } from '../../store/ui';
import { StaticCoin } from './StaticCoin';

const CoinDropScene = lazy(() => import('./CoinDropScene'));

/** ฟัง event "celebrate" แล้วแสดงเหรียญหล่นลงกระปุก (ไม่บล็อกการคลิก) */
export function Celebration() {
  const celebrate = useUI((s) => s.celebrate);
  const reduced = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (celebrate > 0 && !reduced) setActive(celebrate);
  }, [celebrate, reduced]);

  // fallback: ปิดเองถ้า scene ไม่แจ้งกลับ
  useEffect(() => {
    if (active === null) return;
    const t = setTimeout(() => setActive(null), 2200);
    return () => clearTimeout(t);
  }, [active]);

  const webgl = hasWebGL();

  return (
    <AnimatePresence>
      {active !== null && (
        <motion.div
          key={active}
          aria-hidden
          className="pointer-events-none fixed bottom-24 right-2 z-[55] h-56 w-56 lg:bottom-8 lg:right-8"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
        >
          {webgl ? (
            <Suspense fallback={null}>
              <CoinDropScene onDone={() => setActive(null)} />
            </Suspense>
          ) : (
            <motion.div initial={{ y: -80 }} animate={{ y: 0 }} transition={{ type: 'spring', bounce: 0.6 }} className="p-10">
              <StaticCoin />
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
