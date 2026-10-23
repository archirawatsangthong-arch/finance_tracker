import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { budgetLevel, LEVEL_COLOR } from '../../lib/stats';

/** progress ring ที่เปลี่ยนสีตามระดับ (หรือกำหนดสีเองได้) */
export function ProgressRing({
  percent,
  size = 72,
  stroke = 7,
  color,
  children,
  label,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
  label: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, percent));
  const col = color ?? LEVEL_COLOR[budgetLevel(percent)];
  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-fg/10" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (p / 100) * c }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${col}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ percent, color, label }: { percent: number; color?: string; label: string }) {
  const p = Math.min(100, Math.max(0, percent));
  const col = color ?? LEVEL_COLOR[budgetLevel(percent)];
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-fg/10"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: col, boxShadow: `0 0 10px ${col}88` }}
        initial={{ width: 0 }}
        animate={{ width: `${p}%` }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}
