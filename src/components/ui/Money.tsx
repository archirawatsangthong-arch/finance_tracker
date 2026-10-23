import { animate, useMotionValue, useMotionValueEvent } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../hooks/useEnv';
import { formatMoney, MASK } from '../../lib/format';
import { useSettings } from '../../store/settings';

interface MoneyProps {
  value: number;
  /** นับขึ้นแบบ count-up ตอนค่าเปลี่ยน */
  animated?: boolean;
  sign?: boolean;
  compact?: boolean;
  className?: string;
}

/** แสดงจำนวนเงิน — รองรับ privacy mode (****) และ count-up animation */
export function Money({ value, animated = false, sign, compact, className = '' }: MoneyProps) {
  const privacy = useSettings((s) => s.privacy);
  const currency = useSettings((s) => s.currency);
  const reduced = useReducedMotion();
  const mv = useMotionValue(animated && !reduced ? 0 : value);
  const [display, setDisplay] = useState(mv.get());
  const first = useRef(true);

  useMotionValueEvent(mv, 'change', (v) => setDisplay(v));

  useEffect(() => {
    if (!animated || reduced) {
      mv.set(value);
      setDisplay(value);
      return;
    }
    const controls = animate(mv, value, { duration: first.current ? 1.2 : 0.6, ease: [0.16, 1, 0.3, 1] });
    first.current = false;
    return () => controls.stop();
  }, [value, animated, reduced, mv]);

  const text = privacy ? MASK : formatMoney(animated ? display : value, currency, { sign, compact });
  return (
    <span className={`num ${className}`} aria-label={privacy ? 'ซ่อนจำนวนเงิน' : formatMoney(value, currency, { sign })}>
      {text}
    </span>
  );
}
