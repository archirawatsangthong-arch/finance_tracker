import { formatMoney, MASK } from '../../lib/format';
import { useSettings } from '../../store/settings';

interface Item {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
}

interface Props {
  active?: boolean;
  payload?: readonly Item[];
  label?: string | number;
  labelFormatter?: (l: string | number) => string;
}

/** tooltip แบบกระจกให้เข้ากับธีม */
export function ChartTooltip({ active, payload, label, labelFormatter }: Props) {
  const privacy = useSettings((s) => s.privacy);
  const currency = useSettings((s) => s.currency);
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs">
      {label !== undefined && <p className="mb-1 font-medium text-muted">{labelFormatter ? labelFormatter(label) : label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="text-muted">{p.name}</span>
          <span className="num ml-auto font-semibold">{privacy ? MASK : formatMoney(Number(p.value ?? 0), currency)}</span>
        </p>
      ))}
    </div>
  );
}
