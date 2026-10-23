import { eachDayOfInterval, endOfMonth, format, getDate, getDaysInMonth, startOfMonth, subMonths } from 'date-fns';
import type { Category, DateRange, ISODate, Totals, Transaction } from '../types';
import { daysBetween, fromISO, inRange, toISO, todayISO } from './date';

// ===== ฟังก์ชันคำนวณล้วน (pure) — ทดสอบได้ง่าย ไม่ผูกกับ UI =====

export function totals(txs: Transaction[], range?: DateRange): Totals {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (range && !inRange(t.date, range)) continue;
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

/** อัตราการออม = (รายรับ − รายจ่าย) / รายรับ × 100 */
export const savingsRate = (t: Totals): number => (t.income > 0 ? (t.net / t.income) * 100 : 0);

/** ค่าใช้จ่ายเฉลี่ยต่อวัน — ถ้าช่วงยังไม่จบ ให้นับถึงวันนี้เท่านั้น */
export function avgDailyExpense(t: Totals, range: DateRange): number {
  const today = todayISO();
  const end = range.end > today && range.start <= today ? today : range.end;
  const days = Math.max(1, daysBetween(range.start, end));
  return t.expense / days;
}

/** % การเปลี่ยนแปลงเทียบช่วงก่อนหน้า (null ถ้าช่วงก่อนเป็น 0) */
export const percentChange = (current: number, previous: number): number | null =>
  previous === 0 ? null : ((current - previous) / previous) * 100;

/**
 * คาดการณ์รายจ่ายสิ้นเดือน:
 * ใช้ค่าเฉลี่ยรายจ่ายรายวัน "ที่ไม่ใช่รายการซ้ำ" × วันที่เหลือ + รายการซ้ำที่จะเกิดในเดือนนี้
 * เพื่อไม่ให้ค่าเช่าก้อนใหญ่ต้นเดือนทำให้ตัวเลขพุ่งเกินจริง
 */
export function forecastMonthEnd(txs: Transaction[], upcomingRecurringExpense: number, ref = new Date()): number {
  const range = { start: toISO(startOfMonth(ref)), end: toISO(endOfMonth(ref)) };
  const day = getDate(ref);
  const daysInMonth = getDaysInMonth(ref);
  let spent = 0;
  let variable = 0;
  for (const t of txs) {
    if (t.type !== 'expense' || !inRange(t.date, range) || t.date > toISO(ref)) continue;
    spent += t.amount;
    if (!t.recurringId) variable += t.amount;
  }
  const dailyVariable = variable / day;
  return spent + dailyVariable * (daysInMonth - day) + upcomingRecurringExpense;
}

export interface CategorySlice {
  category: Category;
  value: number;
  percent: number;
}

export function byCategory(txs: Transaction[], categories: Category[], range: DateRange, type: 'income' | 'expense' = 'expense'): CategorySlice[] {
  const map = new Map<string, number>();
  let sum = 0;
  for (const t of txs) {
    if (t.type !== type || !inRange(t.date, range)) continue;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
    sum += t.amount;
  }
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const fallback = (id: string): Category => ({ id, name: 'ไม่ระบุ', type, icon: 'tag', color: '#94A3B8', keywords: [], order: 99, systemKey: null });
  return [...map.entries()]
    .map(([id, value]) => ({ category: catMap.get(id) ?? fallback(id), value, percent: sum ? (value / sum) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
}

export interface MonthPoint {
  key: string;
  month: Date;
  income: number;
  expense: number;
  net: number;
}

export function monthlySeries(txs: Transaction[], months = 6, ref = new Date()): MonthPoint[] {
  const points: MonthPoint[] = [];
  const index = new Map<string, MonthPoint>();
  for (let i = months - 1; i >= 0; i--) {
    const m = startOfMonth(subMonths(ref, i));
    const p = { key: format(m, 'yyyy-MM'), month: m, income: 0, expense: 0, net: 0 };
    points.push(p);
    index.set(p.key, p);
  }
  for (const t of txs) {
    const p = index.get(t.date.slice(0, 7));
    if (!p) continue;
    if (t.type === 'income') p.income += t.amount;
    else p.expense += t.amount;
  }
  points.forEach((p) => (p.net = p.income - p.expense));
  return points;
}

export interface DayPoint {
  date: ISODate;
  income: number;
  expense: number;
}

export function dailySeries(txs: Transaction[], range: DateRange): DayPoint[] {
  const map = new Map<ISODate, DayPoint>();
  for (const d of eachDayOfInterval({ start: fromISO(range.start), end: fromISO(range.end) })) {
    const key = toISO(d);
    map.set(key, { date: key, income: 0, expense: 0 });
  }
  for (const t of txs) {
    const p = map.get(t.date);
    if (!p) continue;
    if (t.type === 'income') p.income += t.amount;
    else p.expense += t.amount;
  }
  return [...map.values()];
}

/** รวมยอดใช้จ่ายของแต่ละหมวดในเดือนปัจจุบัน — ใช้กับระบบงบประมาณ */
export function spentByCategory(txs: Transaction[], range: DateRange): Map<string, number> {
  const map = new Map<string, number>();
  let all = 0;
  for (const t of txs) {
    if (t.type !== 'expense' || !inRange(t.date, range)) continue;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
    all += t.amount;
  }
  map.set('all', all);
  return map;
}

export type BudgetLevel = 'safe' | 'warn' | 'danger';

/** เขียว < 70%, เหลือง 70–90%, แดง > 90% */
export const budgetLevel = (percent: number): BudgetLevel => (percent > 90 ? 'danger' : percent >= 70 ? 'warn' : 'safe');

export const LEVEL_COLOR: Record<BudgetLevel, string> = { safe: '#34D399', warn: '#FBBF24', danger: '#F87171' };

/** ต้องออมวันละ/เดือนละเท่าไหร่จึงถึงเป้า */
export function goalPlan(target: number, saved: number, deadline?: ISODate | null, ref = new Date()) {
  const remaining = Math.max(0, target - saved);
  const progress = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
  if (!deadline) return { remaining, progress, daysLeft: null, perDay: null, perMonth: null, overdue: false };
  const daysLeft = daysBetween(toISO(ref), deadline) - 1;
  const overdue = daysLeft <= 0 && remaining > 0;
  const d = Math.max(1, daysLeft);
  return { remaining, progress, daysLeft, perDay: remaining / d, perMonth: remaining / Math.max(1, d / 30.4375), overdue };
}
