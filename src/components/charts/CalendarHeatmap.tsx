import { addDays, startOfWeek, subDays } from 'date-fns';
import { useMemo, useState } from 'react';
import { fromISO, toISO, todayISO } from '../../lib/date';
import { formatDate, formatMoney, MASK } from '../../lib/format';
import type { DayPoint } from '../../lib/stats';
import { useSettings } from '../../store/settings';

interface Props {
  data: DayPoint[];
}

const WEEKDAYS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
const LEVELS = ['bg-fg/[0.05]', 'bg-rose-400/25', 'bg-rose-400/45', 'bg-rose-400/70', 'bg-rose-400'];

/** Heatmap ปฏิทิน (แบบ GitHub) — ยิ่งสีเข้ม ยิ่งใช้เงินมาก; แสดงย้อนหลังตามช่วงข้อมูล */
export default function CalendarHeatmap({ data }: Props) {
  const era = useSettings((s) => s.era);
  const privacy = useSettings((s) => s.privacy);
  const currency = useSettings((s) => s.currency);
  const [hover, setHover] = useState<DayPoint | null>(null);

  const { weeks, max } = useMemo(() => {
    const map = new Map(data.map((d) => [d.date, d]));
    const first = data[0]?.date ?? toISO(subDays(new Date(), 90));
    const last = data.at(-1)?.date ?? todayISO();
    const start = startOfWeek(fromISO(first), { weekStartsOn: 1 });
    const weeks: (DayPoint | null)[][] = [];
    let max = 0;
    for (let d = start; toISO(d) <= last; d = addDays(d, 7)) {
      const col: (DayPoint | null)[] = [];
      for (let i = 0; i < 7; i++) {
        const key = toISO(addDays(d, i));
        const p = key >= first && key <= last ? (map.get(key) ?? { date: key, income: 0, expense: 0 }) : null;
        if (p) max = Math.max(max, p.expense);
        col.push(p);
      }
      weeks.push(col);
    }
    return { weeks, max };
  }, [data]);

  // ใช้ราก 2 ช่วยให้วันใช้น้อยยังเห็นสีบ้าง (ไม่โดนวันจ่ายค่าเช่ากดจนจาง)
  const level = (v: number) => (v <= 0 || max === 0 ? 0 : Math.min(4, Math.ceil(Math.sqrt(v / max) * 4)));

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <div className="grid shrink-0 grid-rows-7 gap-1 pt-0 text-[10px] leading-none text-subtle" aria-hidden>
          {WEEKDAYS.map((w) => (
            <span key={w} className="flex h-4 items-center sm:h-5">
              {w}
            </span>
          ))}
        </div>
        <div className="flex gap-1" role="grid" aria-label="ปฏิทินการใช้จ่าย">
          {weeks.map((col, wi) => (
            <div key={wi} className="grid grid-rows-7 gap-1" role="row">
              {col.map((p, di) =>
                p ? (
                  <button
                    key={p.date}
                    type="button"
                    role="gridcell"
                    onMouseEnter={() => setHover(p)}
                    onFocus={() => setHover(p)}
                    onMouseLeave={() => setHover(null)}
                    aria-label={`${formatDate(p.date, era, 'long')} ใช้จ่าย ${privacy ? 'ซ่อน' : formatMoney(p.expense, currency)}`}
                    className={`h-4 w-4 rounded-[4px] transition hover:ring-2 hover:ring-accent/60 sm:h-5 sm:w-5 ${LEVELS[level(p.expense)]} ${p.date === todayISO() ? 'ring-1 ring-accent' : ''}`}
                  />
                ) : (
                  <span key={`e-${wi}-${di}`} className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="num min-h-4 text-muted" aria-live="polite">
          {hover ? `${formatDate(hover.date, era, 'day')} · ${privacy ? MASK : formatMoney(hover.expense, currency)}` : 'แตะหรือชี้ที่ช่องเพื่อดูยอด'}
        </p>
        <div className="flex items-center gap-1 text-subtle" aria-hidden>
          น้อย
          {LEVELS.map((l) => (
            <span key={l} className={`h-3 w-3 rounded-[3px] ${l}`} />
          ))}
          มาก
        </div>
      </div>
    </div>
  );
}
