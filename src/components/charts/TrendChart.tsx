import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate, formatMoney } from '../../lib/format';
import type { MonthSummary } from '../../types';
import { useSettings } from '../../store/settings';
import { ChartTooltip } from './ChartTooltip';

interface Props {
  data: MonthSummary[];
  height?: number;
  /** แสดงแกน Y (ปิดในการ์ดย่อ) */
  axis?: boolean;
}

/** กราฟเส้น (area) รายรับเทียบรายจ่ายรายเดือน */
export default function TrendChart({ data, height = 260, axis = true }: Props) {
  const era = useSettings((s) => s.era);
  const privacy = useSettings((s) => s.privacy);
  const currency = useSettings((s) => s.currency);
  // ตัดเดือนว่างช่วงต้นออก (ก่อนเริ่มบันทึก) แต่เหลืออย่างน้อย 2 จุดให้กราฟยังเป็นเส้น
  const firstIdx = data.findIndex((d) => d.income > 0 || d.expense > 0);
  const trimmed = firstIdx < 0 ? data : data.slice(Math.min(firstIdx, Math.max(0, data.length - 2)));
  const rows = trimmed.map((d) => ({ ...d, label: formatDate(d.month, era, 'monthShort') }));
  const summary = rows.map((r) => `${r.label}: รายรับ ${formatMoney(r.income)} รายจ่าย ${formatMoney(r.expense)}`).join(', ');

  return (
    <figure role="img" aria-label={`กราฟรายรับเทียบรายจ่ายรายเดือน — ${summary}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: axis ? 0 : 8, bottom: 0 }}>
          <defs>
            <linearGradient id="g-income" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#34D399" stopOpacity={0.35} />
              <stop offset="1" stopColor="#34D399" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="g-expense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#F87171" stopOpacity={0.35} />
              <stop offset="1" stopColor="#F87171" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.07} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--subtle)', fontSize: 12 }} dy={6} />
          {axis && (
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fill: 'var(--subtle)', fontSize: 11 }}
              tickFormatter={(v: number) => (privacy ? '' : formatMoney(v, currency, { compact: true }))}
            />
          )}
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--line)', strokeWidth: 1 }} />
          <Area type="monotone" dataKey="income" name="รายรับ" stroke="#34D399" strokeWidth={2.5} fill="url(#g-income)" />
          <Area type="monotone" dataKey="expense" name="รายจ่าย" stroke="#F87171" strokeWidth={2.5} fill="url(#g-expense)" />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  );
}
