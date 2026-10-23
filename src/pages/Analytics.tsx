import { startOfMonth, subDays, subMonths } from 'date-fns';
import { Activity, CalendarDays, Lightbulb, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from '../components/charts/ChartTooltip';
import { Card, PageHeader, Skeleton } from '../components/ui/Card';
import { CategoryIcon } from '../components/ui/CategoryIcon';
import { EmptyState } from '../components/ui/EmptyState';
import { Money } from '../components/ui/Money';
import { PeriodPicker } from '../components/ui/PeriodPicker';
import { ProgressBar } from '../components/ui/Progress';
import { useCategories, useMonthlySummary, useTxRange } from '../hooks/useData';
import { PERIOD_LABEL, useSummary } from '../hooks/useSummary';
import { periodRange, toISO, todayISO } from '../lib/date';
import { formatDate, formatMoney, formatPercent } from '../lib/format';
import { dailySeries } from '../lib/stats';
import { useSettings } from '../store/settings';
import type { DateRange, Period } from '../types';

const TrendChart = lazy(() => import('../components/charts/TrendChart'));
const CategoryDonut = lazy(() => import('../components/charts/CategoryDonut'));
const CalendarHeatmap = lazy(() => import('../components/charts/CalendarHeatmap'));

const WEEKDAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

export default function Analytics() {
  const categories = useCategories();
  const { era, privacy, currency } = useSettings();
  const [period, setPeriod] = useState<Period>('month');
  const [custom, setCustom] = useState<DateRange>(() => periodRange('month'));
  const s = useSummary(period, custom);

  const [now] = useState(() => new Date());
  const monthsQ = useMonthlySummary(toISO(startOfMonth(subMonths(now, 5))), toISO(startOfMonth(now)));
  const heatRange = useMemo(() => ({ start: toISO(subDays(now, 7 * 17 - 1)), end: todayISO() }), [now]);
  const heatTx = useTxRange(heatRange.start, heatRange.end);
  const heat = useMemo(() => dailySeries(heatTx.data ?? [], heatRange), [heatTx.data, heatRange]);
  const txs = s.transactions;

  // insight: วันในสัปดาห์ที่ใช้จ่ายเฉลี่ยมากที่สุด
  const weekday = useMemo(() => {
    const sum = Array(7).fill(0);
    const count = Array(7).fill(0);
    for (const d of heat) {
      const wd = new Date(d.date + 'T00:00:00').getDay();
      sum[wd] += d.expense;
      count[wd]++;
    }
    const avg = sum.map((v, i) => (count[i] ? v / count[i] : 0));
    const top = avg.indexOf(Math.max(...avg));
    return { avg, top };
  }, [heat]);

  const biggest = useMemo(
    () => (txs ?? []).filter((t) => t.type === 'expense' && t.date >= s.range.start && t.date <= s.range.end).sort((a, b) => b.amount - a.amount).slice(0, 5),
    [txs, s.range.start, s.range.end],
  );
  const catMap = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);

  const weekdayData = [1, 2, 3, 4, 5, 6, 0].map((i) => ({ name: WEEKDAY_NAMES[i].slice(0, 2), value: Math.round(weekday.avg[i]) }));

  if (!s.loading && s.txCount === 0) {
    return (
      <div>
        <PageHeader title="วิเคราะห์" />
        <Card>
          <EmptyState title="ยังไม่มีข้อมูลให้วิเคราะห์" description="เมื่อบันทึกรายการแล้ว กราฟและ insight จะปรากฏที่นี่" />
        </Card>
      </div>
    );
  }

  const insights: { icon: typeof Lightbulb; text: string; tone: string }[] = [];
  if (s.expenseChange !== null)
    insights.push({
      icon: s.expenseChange > 0 ? TrendingUp : TrendingDown,
      tone: s.expenseChange > 0 ? 'text-expense' : 'text-income',
      text: `เดือนนี้ใช้จ่าย${s.expenseChange > 0 ? 'มากขึ้น' : 'น้อยลง'} ${formatPercent(Math.abs(s.expenseChange))} เทียบกับเดือนก่อน`,
    });
  if (s.top3[0]) insights.push({ icon: Target, tone: 'text-warn', text: `${s.top3[0].category.name} คือหมวดที่ใช้มากที่สุด (${formatPercent(s.top3[0].percent)} ของรายจ่าย${PERIOD_LABEL[period]})` });
  if (weekday.avg[weekday.top] > 0) insights.push({ icon: CalendarDays, tone: 'text-accent-soft', text: `วัน${WEEKDAY_NAMES[weekday.top]}เป็นวันที่ใช้เงินเฉลี่ยมากที่สุด` });
  insights.push({
    icon: Activity,
    tone: s.savingsRate >= 20 ? 'text-income' : 'text-warn',
    text: s.savingsRate >= 20 ? `อัตราการออม ${formatPercent(s.savingsRate)} อยู่ในเกณฑ์ดีมาก` : `อัตราการออม ${formatPercent(s.savingsRate)} — ลองลดหมวด${s.top3[0]?.category.name ?? 'ที่ใช้มาก'}ลงอีกนิด`,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="วิเคราะห์" subtitle={`${formatDate(s.range.start, era, 'short')} – ${formatDate(s.range.end, era, 'short')}`} action={<PeriodPicker value={period} onChange={setPeriod} custom={custom} onCustomChange={setCustom} />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'รายรับ', node: <Money value={s.current.income} animated className="text-income" /> },
          { label: 'รายจ่าย', node: <Money value={s.current.expense} animated className="text-expense" /> },
          { label: 'เฉลี่ยต่อวัน', node: <Money value={s.avgDaily} animated /> },
          { label: 'คาดการณ์สิ้นเดือน', node: <Money value={s.forecast} animated /> },
        ].map((x) => (
          <div key={x.label} className="glass rounded-2xl p-4">
            <p className="text-xs text-muted">{x.label}</p>
            <div className="mt-1.5 text-lg font-semibold">{x.node}</div>
          </div>
        ))}
      </div>

      <Card title="Insight">
        <ul className="grid gap-3 sm:grid-cols-2">
          {insights.map((i, k) => (
            <li key={k} className="flex items-start gap-3 rounded-xl bg-fg/[0.03] p-3 text-sm">
              <i.icon size={18} className={`mt-0.5 shrink-0 ${i.tone}`} aria-hidden />
              <span>{privacy ? i.text.replace(/[\d,.]+%/g, '**%') : i.text}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="รายรับเทียบรายจ่ายรายเดือน">
        {monthsQ.data ? (
          <Suspense fallback={<Skeleton className="h-64" />}>
            <TrendChart data={monthsQ.data} height={280} />
          </Suspense>
        ) : (
          <Skeleton className="h-64" />
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`สัดส่วนรายจ่าย${PERIOD_LABEL[period]}`}>
          {s.slices.length ? (
            <Suspense fallback={<Skeleton className="h-64" />}>
              <CategoryDonut data={s.slices} height={260} />
            </Suspense>
          ) : (
            <p className="py-16 text-center text-sm text-subtle">ไม่มีรายจ่ายในช่วงนี้</p>
          )}
        </Card>
        <Card title="ทุกหมวดหมู่">
          <ul className="space-y-3.5">
            {s.slices.map((sl) => (
              <li key={sl.category.id}>
                <div className="mb-1.5 flex items-center gap-2.5">
                  <CategoryIcon icon={sl.category.icon} color={sl.category.color} size="sm" />
                  <span className="flex-1 text-sm">{sl.category.name}</span>
                  <Money value={sl.value} className="text-sm font-semibold" />
                  <span className="num w-12 text-right text-xs text-subtle">{formatPercent(sl.percent, 0)}</span>
                </div>
                <ProgressBar percent={sl.percent} color={sl.category.color} label={`${sl.category.name} ${formatPercent(sl.percent)}`} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="ปฏิทินการใช้จ่าย (17 สัปดาห์ล่าสุด)">
        {heatTx.data ? (
          <Suspense fallback={<Skeleton className="h-36" />}>
            <CalendarHeatmap data={heat} />
          </Suspense>
        ) : (
          <Skeleton className="h-36" />
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="ค่าใช้จ่ายเฉลี่ยตามวันในสัปดาห์">
          <div style={{ height: 220 }} role="img" aria-label={`ค่าใช้จ่ายเฉลี่ย: ${weekdayData.map((d) => `${d.name} ${formatMoney(d.value)}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdayData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.07} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'var(--subtle)', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} width={48} tick={{ fill: 'var(--subtle)', fontSize: 11 }} tickFormatter={(v: number) => (privacy ? '' : formatMoney(v, currency, { compact: true }))} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'currentColor', fillOpacity: 0.04 }} />
                <Bar dataKey="value" name="เฉลี่ย" fill="#8B5CF6" radius={[8, 8, 4, 4]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={`รายจ่ายก้อนใหญ่${PERIOD_LABEL[period]}`}>
          <ul className="space-y-3">
            {biggest.map((t) => {
              const c = catMap.get(t.categoryId);
              return (
                <li key={t.id} className="flex items-center gap-3">
                  <CategoryIcon icon={c?.icon ?? 'tag'} color={c?.color ?? '#94A3B8'} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{t.note || c?.name}</span>
                    <span className="text-xs text-subtle">{formatDate(t.date, era, 'day')}</span>
                  </span>
                  <Money value={t.amount} className="text-sm font-semibold text-expense" />
                </li>
              );
            })}
            {!biggest.length && <li className="text-sm text-subtle">ไม่มีรายจ่ายในช่วงนี้</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
