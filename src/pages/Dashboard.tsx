import { startOfMonth, subMonths } from 'date-fns';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Eye, EyeOff, PiggyBank, Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Hero3D } from '../components/three/Hero3D';
import { TransactionList } from '../components/transactions/TransactionList';
import { Card, Skeleton } from '../components/ui/Card';
import { CategoryIcon } from '../components/ui/CategoryIcon';
import { EmptyState } from '../components/ui/EmptyState';
import { Money } from '../components/ui/Money';
import { PeriodPicker } from '../components/ui/PeriodPicker';
import { TiltCard } from '../components/ui/TiltCard';
import { useMonthlySummary, useProfile, useRecentTx } from '../hooks/useData';
import { PERIOD_LABEL, useSummary } from '../hooks/useSummary';
import { periodRange, toISO } from '../lib/date';
import { formatDate, formatPercent } from '../lib/format';
import { useSettings } from '../store/settings';
import { useUI } from '../store/ui';
import type { DateRange, Period } from '../types';

const TrendChart = lazy(() => import('../components/charts/TrendChart'));
const CategoryDonut = lazy(() => import('../components/charts/CategoryDonut'));

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'อรุณสวัสดิ์' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
};

function StatCard({ label, value, icon: Icon, tone, hint }: { label: string; value: ReactNode; icon: typeof Wallet; tone: string; hint?: ReactNode }) {
  return (
    <TiltCard className="h-full p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`} aria-hidden>
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-3 text-lg font-semibold tracking-tight sm:text-xl">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-subtle">{hint}</div>}
    </TiltCard>
  );
}

function Change({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span>ไม่มีข้อมูลเดือนก่อน</span>;
  const up = value >= 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`num inline-flex items-center gap-0.5 font-medium ${good ? 'text-income' : 'text-expense'}`}>
      <Icon size={12} aria-hidden />
      {up ? 'เพิ่มขึ้น' : 'ลดลง'} {formatPercent(Math.abs(value))} จากเดือนก่อน
    </span>
  );
}

export default function Dashboard() {
  const { privacy, togglePrivacy, era } = useSettings();
  const { data: profile } = useProfile();
  const openEditor = useUI((s) => s.openEditor);
  const [period, setPeriod] = useState<Period>('month');
  const [custom, setCustom] = useState<DateRange>(() => periodRange('month'));
  const s = useSummary(period, custom);
  const recent = useRecentTx(8);
  const now = new Date();
  const series = useMonthlySummary(toISO(startOfMonth(subMonths(now, 5))), toISO(startOfMonth(now)));
  const empty = !s.loading && !recent.isPending && s.txCount === 0 && (recent.data?.length ?? 0) === 0;
  const firstName = profile?.displayName?.split(' ')[0];

  return (
    <div className="space-y-6">
      {/* ===== Hero: ยอดคงเหลือ + โมเดล 3D ===== */}
      <section className="glass glow-border relative overflow-hidden rounded-3xl" aria-labelledby="balance-title">
        <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative grid items-center gap-2 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
          <div>
            <p className="text-sm text-muted">
              {greeting()}
              {firstName ? ` คุณ${firstName}` : ''} · {formatDate(new Date(), era, 'long')}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <h1 id="balance-title" className="text-sm font-medium text-muted">
                ยอดคงเหลือทั้งหมด
              </h1>
              <button type="button" onClick={togglePrivacy} className="btn-ghost p-1.5" aria-pressed={privacy} aria-label={privacy ? 'แสดงตัวเลข' : 'ซ่อนตัวเลข'}>
                {privacy ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {s.loading ? (
              <Skeleton className="mt-2 h-12 w-64" />
            ) : (
              <Money value={s.balance} animated className="mt-1 block text-4xl font-bold tracking-tight sm:text-5xl" />
            )}
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-income" aria-hidden />
                <span className="text-muted">รายรับเดือนนี้</span>
                <Money value={s.month.income} animated className="font-semibold text-income" />
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-expense" aria-hidden />
                <span className="text-muted">รายจ่ายเดือนนี้</span>
                <Money value={s.month.expense} animated className="font-semibold text-expense" />
              </span>
            </div>
          </div>
          <Hero3D className="mx-auto -my-4 h-48 w-full max-w-xs sm:h-56 sm:w-72" />
        </div>
      </section>

      {empty ? (
        <Card>
          <EmptyState
            title="ยังไม่มีรายการ"
            description="เริ่มบันทึกรายรับรายจ่ายรายการแรก แล้วภาพรวมการเงินของคุณจะปรากฏที่นี่"
            action={
              <button type="button" className="btn-primary" onClick={() => openEditor()}>
                <Plus size={16} /> เพิ่มรายการแรก
              </button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">สรุป{PERIOD_LABEL[period]}</h2>
            <PeriodPicker value={period} onChange={setPeriod} custom={custom} onCustomChange={setCustom} />
          </div>

          {/* ===== การ์ดสรุป (3D tilt) ===== */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="รายรับ" icon={TrendingUp} tone="bg-income/15 text-income" value={<Money value={s.current.income} animated className="text-income" />} hint={period === 'month' && <Change value={s.incomeChange} />} />
            <StatCard label="รายจ่าย" icon={TrendingDown} tone="bg-expense/15 text-expense" value={<Money value={s.current.expense} animated className="text-expense" />} hint={period === 'month' && <Change value={s.expenseChange} invert />} />
            <StatCard label="ยอดสุทธิ" icon={Wallet} tone="bg-accent/15 text-accent-soft" value={<Money value={s.current.net} animated sign />} hint={<>เฉลี่ยใช้ <Money value={s.avgDaily} /> / วัน</>} />
            <StatCard label="อัตราการออม" icon={PiggyBank} tone="bg-sky-400/15 text-sky-400" value={<span className="num">{privacy ? '**' : formatPercent(s.savingsRate)}</span>} hint={s.savingsRate >= 20 ? 'ดีมาก ออมได้ตามเป้า 20%+' : 'แนะนำให้ออม 20% ขึ้นไป'} />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card title="รายรับ vs รายจ่าย 6 เดือน" className="lg:col-span-3" action={<Link to="/app/analytics" className="text-xs font-medium text-accent-soft hover:underline">ดูละเอียด</Link>}>
              {series.data ? (
                <Suspense fallback={<Skeleton className="h-56" />}>
                  <TrendChart data={series.data} height={220} />
                </Suspense>
              ) : (
                <Skeleton className="h-56" />
              )}
            </Card>
            <Card title={`สัดส่วนรายจ่าย${PERIOD_LABEL[period]}`} className="lg:col-span-2">
              {s.transactions === undefined ? (
                <Skeleton className="h-56" />
              ) : s.slices.length ? (
                <Suspense fallback={<Skeleton className="h-56" />}>
                  <CategoryDonut data={s.slices} height={200} />
                </Suspense>
              ) : (
                <p className="py-16 text-center text-sm text-subtle">ยังไม่มีรายจ่ายในช่วงนี้</p>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card title="รายการล่าสุด" className="lg:col-span-3" action={<Link to="/app/transactions" className="flex items-center text-xs font-medium text-accent-soft hover:underline">ทั้งหมด <ChevronRight size={14} /></Link>}>
              {recent.data === undefined ? (
                <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : (
                <TransactionList transactions={recent.data} />
              )}
            </Card>
            <div className="space-y-4 lg:col-span-2">
              <Card title="คาดการณ์สิ้นเดือน">
                <Money value={s.forecast} className="text-2xl font-semibold" />
                <p className="mt-1 text-xs text-muted">รายจ่ายทั้งเดือนโดยประมาณ จากพฤติกรรมการใช้จ่ายตอนนี้ (รวมรายการซ้ำที่จะถึงกำหนด)</p>
              </Card>
              <Card title="ใช้เงินมากที่สุด 3 อันดับ">
                <ol className="space-y-3">
                  {s.top3.map((t, i) => (
                    <li key={t.category.id} className="flex items-center gap-3">
                      <span className="num w-4 text-xs text-subtle">{i + 1}</span>
                      <CategoryIcon icon={t.category.icon} color={t.category.color} size="sm" />
                      <span className="flex-1 truncate text-sm">{t.category.name}</span>
                      <span className="text-right">
                        <Money value={t.value} className="block text-sm font-semibold" />
                        <span className="num text-[11px] text-subtle">{formatPercent(t.percent)}</span>
                      </span>
                    </li>
                  ))}
                  {!s.top3.length && <li className="text-sm text-subtle">ยังไม่มีข้อมูล</li>}
                </ol>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
