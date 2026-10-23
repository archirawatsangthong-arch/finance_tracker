import { Box, Circle } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { hasWebGL, useReducedMotion } from '../../hooks/useEnv';
import { formatPercent } from '../../lib/format';
import type { CategorySlice } from '../../lib/stats';
import { Money } from '../ui/Money';

const Donut3D = lazy(() => import('../three/Donut3D'));

interface Props {
  data: CategorySlice[];
  /** อนุญาตให้สลับเป็นโหมด 3D */
  allow3D?: boolean;
  height?: number;
}

/** โดนัทสัดส่วนตามหมวดหมู่ — สลับได้ระหว่าง 2D (Recharts) และ 3D (Three.js) */
export default function CategoryDonut({ data, allow3D = true, height = 240 }: Props) {
  const reduced = useReducedMotion();
  const can3D = allow3D && hasWebGL() && !reduced;
  const [mode, setMode] = useState<'2d' | '3d'>(can3D ? '3d' : '2d');
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const focus = active !== null ? data[active] : null;
  // รวมหมวดเล็ก ๆ ไว้ใน legend ด้านล่าง ไม่ให้รก
  const legend = data.slice(0, 6);

  return (
    <div>
      {can3D && (
        <div className="mb-2 flex justify-end">
          <div className="inline-flex rounded-lg bg-fg/5 p-0.5" role="radiogroup" aria-label="รูปแบบกราฟ">
            {(['3d', '2d'] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${mode === m ? 'bg-accent/20 text-fg' : 'text-subtle'}`}>
                {m === '3d' ? <Box size={12} aria-hidden /> : <Circle size={12} aria-hidden />}
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="relative" style={{ height }} role="img" aria-label={`สัดส่วนรายจ่าย: ${data.map((d) => `${d.category.name} ${formatPercent(d.percent)}`).join(', ')}`}>
        {mode === '3d' && can3D ? (
          <Suspense fallback={null}>
            <Donut3D data={data} active={active} onHover={setActive} />
          </Suspense>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="category.name" innerRadius="64%" outerRadius="92%" paddingAngle={2} stroke="none" cornerRadius={6} onMouseEnter={(_, i) => setActive(i)} onMouseLeave={() => setActive(null)} isAnimationActive={!reduced}>
                {data.map((d, i) => (
                  <Cell key={d.category.id} fill={d.category.color} opacity={active === null || active === i ? 1 : 0.35} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
        {/* ตัวเลขตรงกลาง */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-subtle">{focus ? focus.category.name : 'ทั้งหมด'}</span>
          <Money value={focus ? focus.value : total} className="text-base font-semibold" />
          {focus && <span className="num text-[11px] text-muted">{formatPercent(focus.percent)}</span>}
        </div>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {legend.map((d, i) => (
          <li key={d.category.id}>
            <button type="button" onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} className="flex w-full items-center gap-2 rounded-md text-left text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.category.color }} aria-hidden />
              <span className="truncate text-muted">{d.category.name}</span>
              <span className="num ml-auto font-medium">{formatPercent(d.percent, 0)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
