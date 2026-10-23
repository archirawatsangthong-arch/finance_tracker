import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowLeftRight, CalendarPlus, ShieldCheck, UserPlus, Users, UserX } from 'lucide-react';
import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, PageHeader, Skeleton } from '../../components/ui/Card';
import { TiltCard } from '../../components/ui/TiltCard';
import { fetchDaily, fetchMonthly, fetchOverview } from '../../lib/adminApi';
import { formatDate } from '../../lib/format';
import { qk } from '../../lib/queryClient';
import { useSettings } from '../../store/settings';

const fmt = (v: number) => v.toLocaleString('th-TH');

function CountTooltip({ active, payload, label }: { active?: boolean; payload?: readonly { name?: string; value?: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs">
      <p className="mb-1 font-medium text-muted">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="text-muted">{p.name}</span>
          <span className="num ml-auto font-semibold">{fmt(Number(p.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
}

function Stat({ label, value, icon: Icon, hint }: { label: string; value: number | undefined; icon: typeof Users; hint?: string }) {
  return (
    <TiltCard className="h-full p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent-soft" aria-hidden>
          <Icon size={16} />
        </span>
      </div>
      {value === undefined ? <Skeleton className="mt-3 h-7 w-20" /> : <p className="num mt-3 text-2xl font-semibold tracking-tight">{fmt(value)}</p>}
      {hint && <p className="mt-1 text-[11px] text-subtle">{hint}</p>}
    </TiltCard>
  );
}

const axis = { tickLine: false, axisLine: false, tick: { fill: 'var(--subtle)', fontSize: 11 } } as const;

export default function AdminDashboard() {
  const era = useSettings((s) => s.era);
  const [days, setDays] = useState(30);
  const overview = useQuery({ queryKey: [...qk.admin, 'overview'], queryFn: fetchOverview, refetchInterval: 60_000 });
  const daily = useQuery({ queryKey: [...qk.admin, 'daily', days], queryFn: () => fetchDaily(days) });
  const monthly = useQuery({ queryKey: [...qk.admin, 'monthly'], queryFn: () => fetchMonthly(12) });
  const o = overview.data;

  const dailyRows = (daily.data ?? []).map((d) => ({ ...d, label: formatDate(d.day, era, 'day') }));
  const monthlyRows = (monthly.data ?? []).map((m) => ({ ...m, label: formatDate(m.month, era, 'monthShort') }));

  return (
    <div className="space-y-6">
      <PageHeader title="ภาพรวมระบบ" subtitle="สถิติรวมของผู้ใช้ทั้งหมด (อัปเดตทุก 1 นาที)" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="ผู้ใช้ทั้งหมด" value={o?.totalUsers} icon={Users} hint={o ? `ผู้ดูแล ${fmt(o.admins)} คน` : undefined} />
        <Stat label="ผู้ใช้ใหม่วันนี้" value={o?.newToday} icon={UserPlus} hint={o ? `เดือนนี้ ${fmt(o.newThisMonth)} คน` : undefined} />
        <Stat label="ผู้ใช้ active (7 วัน)" value={o?.active7d} icon={Activity} hint={o ? `30 วัน: ${fmt(o.active30d)} คน` : undefined} />
        <Stat label="รายการทั้งหมดในระบบ" value={o?.totalTransactions} icon={ArrowLeftRight} hint={o ? `วันนี้ +${fmt(o.transactionsToday)}` : undefined} />
      </div>

      <Card
        title="ผู้ใช้ใหม่และรายการใหม่รายวัน"
        action={
          <div className="inline-flex rounded-lg bg-fg/5 p-0.5" role="radiogroup" aria-label="ช่วงเวลา">
            {[7, 30, 90].map((d) => (
              <button key={d} type="button" role="radio" aria-checked={days === d} onClick={() => setDays(d)} className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${days === d ? 'bg-accent/20 text-fg' : 'text-subtle'}`}>
                {d} วัน
              </button>
            ))}
          </div>
        }
      >
        {daily.data ? (
          <div style={{ height: 260 }} role="img" aria-label={`ผู้ใช้ใหม่ ${days} วันล่าสุด รวม ${fmt(dailyRows.reduce((s, d) => s + d.newUsers, 0))} คน`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.07} />
                <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={24} />
                <YAxis yAxisId="u" {...axis} width={32} allowDecimals={false} />
                <YAxis yAxisId="t" orientation="right" {...axis} width={40} allowDecimals={false} />
                <Tooltip content={<CountTooltip />} cursor={{ fill: 'currentColor', fillOpacity: 0.04 }} />
                <Bar yAxisId="u" dataKey="newUsers" name="ผู้ใช้ใหม่" fill="#06B6D4" radius={[6, 6, 2, 2]} maxBarSize={22} />
                <Bar yAxisId="t" dataKey="newTransactions" name="รายการใหม่" fill="#8B5CF6" fillOpacity={0.55} radius={[6, 6, 2, 2]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Skeleton className="h-64" />
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="จำนวนผู้ใช้สะสม 12 เดือน" className="lg:col-span-2">
          {monthly.data ? (
            <div style={{ height: 240 }} role="img" aria-label={`ผู้ใช้สะสมล่าสุด ${fmt(monthlyRows.at(-1)?.totalUsers ?? 0)} คน`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g-users" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#06B6D4" stopOpacity={0.4} />
                      <stop offset="1" stopColor="#06B6D4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.07} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} width={40} allowDecimals={false} />
                  <Tooltip content={<CountTooltip />} cursor={{ stroke: 'var(--line)' }} />
                  <Area type="monotone" dataKey="totalUsers" name="ผู้ใช้สะสม" stroke="#06B6D4" strokeWidth={2.5} fill="url(#g-users)" />
                  <Area type="monotone" dataKey="newUsers" name="ผู้ใช้ใหม่" stroke="#67E8F9" strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Skeleton className="h-60" />
          )}
        </Card>
        <Card title="สถานะบัญชี">
          {o ? (
            <ul className="space-y-4 text-sm">
              <li className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-income" aria-hidden />
                <span className="flex-1">ใช้งานได้</span>
                <span className="num font-semibold">{fmt(o.totalUsers - o.suspended)}</span>
              </li>
              <li className="flex items-center gap-3">
                <UserX size={18} className="text-expense" aria-hidden />
                <span className="flex-1">ถูกระงับ</span>
                <span className="num font-semibold">{fmt(o.suspended)}</span>
              </li>
              <li className="flex items-center gap-3">
                <CalendarPlus size={18} className="text-accent-soft" aria-hidden />
                <span className="flex-1">รายการใหม่เดือนนี้</span>
                <span className="num font-semibold">{fmt(monthlyRows.at(-1)?.newTransactions ?? 0)}</span>
              </li>
              <li className="pt-2 text-xs text-subtle">
                อัตราผู้ใช้ active 30 วัน: <span className="num font-medium text-fg">{o.totalUsers ? ((o.active30d / o.totalUsers) * 100).toFixed(1) : '0'}%</span>
              </li>
            </ul>
          ) : (
            <Skeleton className="h-40" />
          )}
        </Card>
      </div>
    </div>
  );
}
