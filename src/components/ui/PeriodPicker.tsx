import { PERIOD_LABEL } from '../../hooks/useSummary';
import type { DateRange, Period } from '../../types';

interface Props {
  value: Period;
  onChange: (p: Period) => void;
  custom?: DateRange;
  onCustomChange?: (r: DateRange) => void;
  options?: Period[];
}

/** แท็บเลือกช่วงเวลา + ช่องวันที่เมื่อเลือก "กำหนดเอง" */
export function PeriodPicker({ value, onChange, custom, onCustomChange, options = ['today', 'week', 'month', 'year', 'custom'] }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex gap-0.5 overflow-x-auto rounded-xl bg-fg/5 p-1 no-scrollbar" role="radiogroup" aria-label="ช่วงเวลา">
        {options.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={value === p}
            onClick={() => onChange(p)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${value === p ? 'bg-accent/20 text-fg shadow-sm' : 'text-muted hover:text-fg'}`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>
      {value === 'custom' && custom && onCustomChange && (
        <div className="flex items-center gap-2 text-xs">
          <label className="sr-only" htmlFor="range-start">
            วันเริ่มต้น
          </label>
          <input id="range-start" type="date" value={custom.start} max={custom.end} onChange={(e) => e.target.value && onCustomChange({ ...custom, start: e.target.value })} className="field w-auto py-1.5 text-xs" />
          <span className="text-subtle">ถึง</span>
          <label className="sr-only" htmlFor="range-end">
            วันสิ้นสุด
          </label>
          <input id="range-end" type="date" value={custom.end} min={custom.start} onChange={(e) => e.target.value && onCustomChange({ ...custom, end: e.target.value })} className="field w-auto py-1.5 text-xs" />
        </div>
      )}
    </div>
  );
}
