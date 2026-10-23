import { AlertTriangle, Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BudgetEditor } from '../components/budget/BudgetEditor';
import { GoalEditor } from '../components/budget/GoalEditor';
import { Card, PageHeader, Skeleton } from '../components/ui/Card';
import { CategoryIcon } from '../components/ui/CategoryIcon';
import { EmptyState } from '../components/ui/EmptyState';
import { Money } from '../components/ui/Money';
import { ProgressBar, ProgressRing } from '../components/ui/Progress';
import { useBudgets, useCategories, useGoals, useRecurring, useTxRange } from '../hooks/useData';
import { run } from '../lib/actions';
import * as api from '../lib/api';
import { qk } from '../lib/queryClient';
import { parseMoney } from '../lib/validation';
import { daysBetween, periodRange, todayISO } from '../lib/date';
import { formatDate, formatPercent } from '../lib/format';
import { getIcon } from '../lib/icons';
import { FREQ_LABEL } from '../lib/recurring';
import { budgetLevel, goalPlan, LEVEL_COLOR, spentByCategory } from '../lib/stats';
import { useSettings } from '../store/settings';
import { toast } from '../store/ui';
import type { Goal } from '../types';

const LEVEL_TEXT = { safe: 'อยู่ในงบ', warn: 'ใกล้เต็มงบ', danger: 'เกือบ/เกินงบ' } as const;

function AddToGoal({ goal }: { goal: Goal }) {
  const [v, setV] = useState('');
  const [error, setError] = useState('');
  const add = async (sign: 1 | -1) => {
    const n = parseMoney(v);
    if (n === null) return setError('กรุณาใส่จำนวนเงินที่มากกว่า 0');
    setError('');
    // บวก/ลบในฐานข้อมูลแบบ atomic — ไม่ทับค่ากันถ้าแก้จากหลายเครื่องพร้อมกัน
    const updated = await run(() => api.applyGoalDelta(goal.id, sign * n), { invalidate: [qk.goals] });
    if (!updated) return;
    setV('');
    if (sign === 1 && updated.saved >= updated.target && goal.saved < goal.target) toast(`🎉 ถึงเป้าหมาย "${goal.name}" แล้ว!`);
    else toast(sign === 1 ? 'เพิ่มเงินออมแล้ว' : 'ถอนเงินออมแล้ว');
  };
  return (
    <>
    <form
      className="mt-4 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void add(1);
      }}
    >
      <label className="sr-only" htmlFor={`add-${goal.id}`}>
        จำนวนเงินที่จะออมเพิ่มสำหรับ {goal.name}
      </label>
      <input id={`add-${goal.id}`} type="text" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))} placeholder="จำนวนเงิน" className="field num py-2" aria-invalid={!!error} />
      <button type="submit" className="btn-primary px-3 py-2" aria-label="ออมเพิ่ม">
        <Plus size={16} />
      </button>
      <button type="button" className="btn-outline px-3 py-2" onClick={() => void add(-1)} aria-label="ถอนออก">
        −
      </button>
    </form>
    {error && (
      <p role="alert" className="mt-1.5 text-xs text-expense">
        {error}
      </p>
    )}
    </>
  );
}

export default function BudgetGoals() {
  const categories = useCategories() ?? [];
  const month = periodRange('month');
  const budgets = useBudgets(month.start).data;
  const goals = useGoals().data;
  const recurring = useRecurring().data ?? [];
  const txs = useTxRange(month.start, month.end).data;
  const era = useSettings((s) => s.era);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [goalEdit, setGoalEdit] = useState<Goal | null | 'new'>(null);

  const spent = useMemo(() => spentByCategory(txs ?? [], periodRange('month')), [txs]);
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const total = budgets?.find((b) => b.categoryId === null);
  const catBudgets = (budgets ?? []).filter((b): b is typeof b & { categoryId: string } => b.categoryId !== null && catMap.has(b.categoryId));
  const daysLeft = daysBetween(todayISO(), month.end);

  const totalPct = total ? ((spent.get('all') ?? 0) / total.amount) * 100 : 0;
  const alerts = [...(total ? [{ name: 'งบรวม', pct: totalPct }] : []), ...catBudgets.map((b) => ({ name: catMap.get(b.categoryId)!.name, pct: ((spent.get(b.categoryId) ?? 0) / b.amount) * 100 }))].filter((a) => a.pct >= 90);

  return (
    <div className="space-y-8">
      <PageHeader
        title="งบประมาณ & เป้าหมาย"
        subtitle={`${formatDate(todayISO(), era, 'month')} · เหลืออีก ${daysLeft} วัน`}
        action={
          <button type="button" className="btn-outline" onClick={() => setBudgetOpen(true)}>
            <Pencil size={15} /> ตั้งงบ
          </button>
        }
      />

      {alerts.length > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-expense/30 bg-expense/10 p-4 text-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-expense" aria-hidden />
          <div>
            <p className="font-semibold">แจ้งเตือนงบประมาณ</p>
            <p className="mt-0.5 text-muted">{alerts.map((a) => `${a.name} ใช้ไป ${formatPercent(a.pct, 0)}`).join(' · ')}</p>
          </div>
        </div>
      )}

      {/* ===== งบรวม ===== */}
      <section aria-labelledby="budget-title" className="space-y-4">
        <h2 id="budget-title" className="text-lg font-semibold">
          งบประมาณเดือนนี้
        </h2>
        {budgets === undefined ? (
          <Skeleton className="h-40" />
        ) : !total && catBudgets.length === 0 ? (
          <Card>
            <EmptyState title="ยังไม่ได้ตั้งงบประมาณ" description="ตั้งงบรายเดือนเพื่อควบคุมการใช้จ่าย และรับการแจ้งเตือนเมื่อใกล้เกินงบ" action={<button type="button" className="btn-primary" onClick={() => setBudgetOpen(true)}>ตั้งงบประมาณ</button>} />
          </Card>
        ) : (
          <>
            {total && (
              <Card as="div" className="flex flex-col items-center gap-6 sm:flex-row">
                <ProgressRing percent={totalPct} size={140} stroke={12} label={`งบรวมใช้ไป ${formatPercent(totalPct, 0)}`}>
                  <div className="text-center">
                    <span className="num block text-2xl font-bold">{formatPercent(totalPct, 0)}</span>
                    <span className="text-[11px] text-subtle">ใช้ไปแล้ว</span>
                  </div>
                </ProgressRing>
                <div className="w-full flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">งบรวมทั้งเดือน</span>
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: `${LEVEL_COLOR[budgetLevel(totalPct)]}22`, color: LEVEL_COLOR[budgetLevel(totalPct)] }}>
                      {LEVEL_TEXT[budgetLevel(totalPct)]}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <Money value={spent.get('all') ?? 0} animated className="text-2xl font-semibold" />
                    <span className="text-sm text-subtle">
                      / <Money value={total.amount} />
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-fg/[0.04] p-3">
                      <p className="text-[11px] text-muted">คงเหลือ</p>
                      <Money value={Math.max(0, total.amount - (spent.get('all') ?? 0))} className="font-semibold" />
                    </div>
                    <div className="rounded-xl bg-fg/[0.04] p-3">
                      <p className="text-[11px] text-muted">ใช้ได้ต่อวัน</p>
                      <Money value={Math.max(0, total.amount - (spent.get('all') ?? 0)) / Math.max(1, daysLeft)} className="font-semibold" />
                    </div>
                  </div>
                </div>
              </Card>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {catBudgets.map((b) => {
                const c = catMap.get(b.categoryId)!;
                const used = spent.get(b.categoryId) ?? 0;
                const pct = (used / b.amount) * 100;
                return (
                  <Card as="article" key={b.categoryId} className="p-4">
                    <div className="flex items-center gap-3">
                      <ProgressRing percent={pct} size={52} stroke={5} label={`${c.name} ใช้ไป ${formatPercent(pct, 0)}`}>
                        <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                      </ProgressRing>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-subtle">
                          <Money value={used} /> / <Money value={b.amount} />
                        </p>
                      </div>
                      <span className="num text-sm font-semibold" style={{ color: LEVEL_COLOR[budgetLevel(pct)] }}>
                        {formatPercent(pct, 0)}
                      </span>
                    </div>
                    <div className="mt-3">
                      <ProgressBar percent={pct} label={`${c.name} ${formatPercent(pct, 0)}`} />
                    </div>
                    <p className="mt-2 text-[11px] text-subtle">
                      {used > b.amount ? <>เกินงบ <Money value={used - b.amount} /></> : <>เหลือ <Money value={b.amount - used} /></>}
                    </p>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* ===== เป้าหมายการออม ===== */}
      <section aria-labelledby="goal-title" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="goal-title" className="text-lg font-semibold">
            เป้าหมายการออม
          </h2>
          <button type="button" className="btn-primary" onClick={() => setGoalEdit('new')}>
            <Plus size={16} /> เป้าหมายใหม่
          </button>
        </div>
        {goals === undefined ? (
          <Skeleton className="h-48" />
        ) : goals.length === 0 ? (
          <Card>
            <EmptyState title="ยังไม่มีเป้าหมาย" description='เช่น "เที่ยวญี่ปุ่น 50,000 บาท" แล้วเราจะบอกว่าต้องออมวันละเท่าไหร่' />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((g) => {
              const plan = goalPlan(g.target, g.saved, g.deadline);
              const Icon = getIcon(g.icon);
              const done = plan.remaining === 0;
              return (
                <Card as="article" key={g.id}>
                  <div className="flex items-start gap-4">
                    <ProgressRing percent={plan.progress} color={g.color} size={76} stroke={7} label={`${g.name} ${formatPercent(plan.progress, 0)}`}>
                      <Icon size={22} style={{ color: g.color }} aria-hidden />
                    </ProgressRing>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="truncate font-semibold">{g.name}</h3>
                        <button type="button" className="btn-ghost -mr-2 -mt-1 p-1.5" onClick={() => setGoalEdit(g)} aria-label={`แก้ไข ${g.name}`}>
                          <Pencil size={14} />
                        </button>
                      </div>
                      <p className="mt-0.5 text-sm">
                        <Money value={g.saved} animated className="font-semibold" /> <span className="text-subtle">/ <Money value={g.target} /></span>
                      </p>
                      <p className="num mt-0.5 text-xs" style={{ color: g.color }}>
                        {formatPercent(plan.progress, 0)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl bg-fg/[0.04] p-3 text-xs text-muted">
                    {done ? (
                      <span className="font-medium text-income">🎉 ถึงเป้าหมายแล้ว!</span>
                    ) : plan.daysLeft === null ? (
                      <>
                        เหลืออีก <Money value={plan.remaining} className="font-semibold text-fg" /> — ตั้งวันเป้าหมายเพื่อดูแผนการออม
                      </>
                    ) : plan.overdue ? (
                      <span className="text-expense">เลยกำหนดแล้ว ยังขาดอีก <Money value={plan.remaining} /></span>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p>ต้องออมวันละ</p>
                          <Money value={plan.perDay!} className="text-sm font-semibold text-fg" />
                        </div>
                        <div>
                          <p>หรือเดือนละ</p>
                          <Money value={plan.perMonth!} className="text-sm font-semibold text-fg" />
                        </div>
                        <p className="col-span-2 text-[11px] text-subtle">
                          ภายใน {formatDate(g.deadline ?? todayISO(), era, 'short')} (อีก {plan.daysLeft} วัน)
                        </p>
                      </div>
                    )}
                  </div>
                  {!done && <AddToGoal goal={g} />}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ===== รายการซ้ำ ===== */}
      <section aria-labelledby="rec-title" className="space-y-4">
        <h2 id="rec-title" className="text-lg font-semibold">
          รายการซ้ำ
        </h2>
        <Card as="div">
          {recurring.length === 0 ? (
            <p className="py-6 text-center text-sm text-subtle">ยังไม่มีรายการซ้ำ — เลือก "ทำซ้ำ" ตอนเพิ่มรายการ เช่น ค่าเช่า, Netflix</p>
          ) : (
            <ul className="divide-y divide-line">
              {recurring.map((r) => {
                const c = catMap.get(r.categoryId);
                return (
                  <li key={r.id} className={`flex items-center gap-3 py-3 ${r.active ? '' : 'opacity-50'}`}>
                    <CategoryIcon icon={c?.icon ?? 'tag'} color={c?.color ?? '#94A3B8'} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {r.note || c?.name} <Repeat size={12} className="text-subtle" aria-hidden />
                      </p>
                      <p className="text-xs text-subtle">
                        {FREQ_LABEL[r.frequency]} · ครั้งถัดไป {formatDate(r.nextDate, era, 'short')}
                      </p>
                    </div>
                    <Money value={r.type === 'income' ? r.amount : -r.amount} sign className={`text-sm font-semibold ${r.type === 'income' ? 'text-income' : ''}`} />
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" className="peer sr-only" checked={r.active} onChange={() => void run(() => api.setRecurringActive(r.id, !r.active), { invalidate: [qk.recurring] })} aria-label={`เปิด/ปิด ${r.note}`} />
                      <span className="h-6 w-10 rounded-full bg-fg/15 transition peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent-soft after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
                    </label>
                    <button
                      type="button"
                      className="btn-ghost p-2"
                      aria-label={`ลบรายการซ้ำ ${r.note}`}
                      onClick={async () => {
                        if (!window.confirm(`ลบรายการซ้ำ "${r.note || 'ไม่มีชื่อ'}"? รายการที่สร้างไปแล้วจะยังอยู่`)) return;
                        await run(() => api.deleteRecurring(r.id), { success: 'ลบรายการซ้ำแล้ว', invalidate: [qk.recurring, qk.tx] });
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      <BudgetEditor open={budgetOpen} onClose={() => setBudgetOpen(false)} budgets={budgets ?? []} categories={categories} month={month.start} />
      <GoalEditor open={goalEdit !== null} onClose={() => setGoalEdit(null)} goal={goalEdit === 'new' ? null : goalEdit} />
    </div>
  );
}
