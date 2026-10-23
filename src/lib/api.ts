import { supabase } from './supabase';
import type {
  Budget, Category, Frequency, Goal, ISODate, MonthSummary, PaymentMethod, Profile, Recurring, Totals, Transaction, TxFilters, TxType,
} from '../types';

// ===== ชั้นเข้าถึงข้อมูล Supabase: แปลง snake_case ↔ camelCase และโยน error เมื่อผิดพลาด =====
// ทุก query ผ่าน RLS — ผู้ใช้เห็นเฉพาะข้อมูลของตัวเองเสมอ

const PAGE = 1000; // PostgREST คืนได้สูงสุด 1,000 แถวต่อคำขอ

function must<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0));

// ---------- mappers ----------
type Row = Record<string, unknown>;

export const toProfile = (r: Row): Profile => ({
  id: r.id as string,
  displayName: (r.display_name as string) ?? '',
  avatarUrl: (r.avatar_url as string | null) ?? null,
  currency: r.currency as Profile['currency'],
  theme: r.theme as Profile['theme'],
  useBuddhistYear: Boolean(r.use_buddhist_year),
  role: r.role as Profile['role'],
  isSuspended: Boolean(r.is_suspended),
  createdAt: r.created_at as string,
});

export const toTx = (r: Row): Transaction => ({
  id: r.id as string,
  type: r.type as TxType,
  amount: num(r.amount),
  categoryId: r.category_id as string,
  date: r.date as ISODate,
  note: (r.note as string) ?? '',
  paymentMethod: r.payment_method as PaymentMethod,
  recurringId: (r.recurring_rule_id as string | null) ?? null,
  createdAt: r.created_at as string,
});

const toCategory = (r: Row): Category => ({
  id: r.id as string,
  name: r.name as string,
  type: r.type as TxType,
  icon: r.icon as string,
  color: r.color as string,
  keywords: (r.keywords as string[]) ?? [],
  order: num(r.sort_order),
  systemKey: (r.system_key as Category['systemKey']) ?? null,
});

const toGoal = (r: Row): Goal => ({
  id: r.id as string,
  name: r.name as string,
  target: num(r.target_amount),
  saved: num(r.current_amount),
  deadline: (r.deadline as string | null) ?? null,
  icon: r.icon as string,
  color: r.color as string,
  createdAt: r.created_at as string,
});

const toRecurring = (r: Row): Recurring => ({
  id: r.id as string,
  type: r.type as TxType,
  amount: num(r.amount),
  categoryId: r.category_id as string,
  note: (r.note as string) ?? '',
  paymentMethod: r.payment_method as PaymentMethod,
  frequency: r.frequency as Frequency,
  startDate: r.start_date as string,
  occurrences: num(r.occurrences),
  nextDate: r.next_run_date as string,
  active: Boolean(r.active),
});

const toTotals = (r: Row | undefined): Totals & { count: number } => ({
  income: num(r?.income),
  expense: num(r?.expense),
  net: num(r?.net),
  count: num(r?.tx_count),
});

// ---------- profile ----------
export async function fetchProfile(userId: string): Promise<Profile> {
  return toProfile(must(await supabase.from('profiles').select('*').eq('id', userId).single()));
}

export type ProfilePatch = Partial<Pick<Profile, 'displayName' | 'avatarUrl' | 'currency' | 'theme' | 'useBuddhistYear'>>;

export async function updateProfile(userId: string, patch: ProfilePatch): Promise<void> {
  const row: Row = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName.trim().slice(0, 60);
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
  if (patch.currency !== undefined) row.currency = patch.currency;
  if (patch.theme !== undefined) row.theme = patch.theme;
  if (patch.useBuddhistYear !== undefined) row.use_buddhist_year = patch.useBuddhistYear;
  must(await supabase.from('profiles').update(row).eq('id', userId));
}

export async function touchLastSeen(): Promise<void> {
  await supabase.rpc('touch_last_seen');
}

// ---------- categories ----------
export async function fetchCategories(): Promise<Category[]> {
  const rows = must(await supabase.from('categories').select('*').order('sort_order').order('created_at'));
  return rows.map(toCategory);
}

export type CategoryInput = Pick<Category, 'name' | 'type' | 'icon' | 'color' | 'keywords'> & { order?: number };

export async function saveCategory(input: CategoryInput, id?: string): Promise<void> {
  const row = {
    name: input.name.trim().slice(0, 40),
    icon: input.icon,
    color: input.color,
    keywords: input.keywords.map((k) => k.slice(0, 40)).slice(0, 50),
  };
  if (id) must(await supabase.from('categories').update(row).eq('id', id));
  else must(await supabase.from('categories').insert({ ...row, type: input.type, sort_order: input.order ?? 100 }));
}

/** ลบหมวด — รายการที่ใช้หมวดนี้จะย้ายไป "อื่น ๆ" อัตโนมัติ คืนจำนวนรายการที่ถูกย้าย */
export async function deleteCategory(id: string): Promise<number> {
  return num(must(await supabase.rpc('delete_category', { p_id: id })));
}

export async function countCategoryUsage(id: string): Promise<number> {
  const { count, error } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('category_id', id);
  if (error) throw error;
  return count ?? 0;
}

// ---------- transactions ----------
const TX_COLS = 'id, type, amount, category_id, date, note, payment_method, recurring_rule_id, created_at';

/** ดึงรายการทั้งหมดในช่วงวันที่ (แบ่งหน้าอัตโนมัติ) */
export async function fetchTransactionsInRange(start: ISODate, end: ISODate): Promise<Transaction[]> {
  const out: Transaction[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = must(
      await supabase
        .from('transactions')
        .select(TX_COLS)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, from + PAGE - 1),
    );
    out.push(...rows.map(toTx));
    if (rows.length < PAGE || out.length >= 100_000) return out;
  }
}

export async function fetchRecentTransactions(limit = 8): Promise<Transaction[]> {
  const rows = must(
    await supabase.from('transactions').select(TX_COLS).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(limit),
  );
  return rows.map(toTx);
}

const searchParams = (f: TxFilters) => ({
  p_query: f.query.trim() || null,
  p_type: f.type === 'all' ? null : f.type,
  p_categories: f.categories.length ? f.categories : null,
  p_start: f.start || null,
  p_end: f.end || null,
  p_min: f.min ? Number(f.min) : null,
  p_max: f.max ? Number(f.max) : null,
});

export async function searchTransactions(f: TxFilters, offset: number, limit: number): Promise<Transaction[]> {
  const rows = must(await supabase.rpc('search_transactions', { ...searchParams(f), p_limit: limit, p_offset: offset }));
  return (rows as Row[]).map(toTx);
}

export async function searchTotals(f: TxFilters): Promise<Totals & { count: number }> {
  const rows = must(await supabase.rpc('search_totals', searchParams(f))) as Row[];
  return toTotals(rows[0]);
}

export interface TxWrite {
  id?: string;
  type: TxType;
  amount: number;
  categoryId: string;
  date: ISODate;
  note: string;
  paymentMethod: PaymentMethod;
  recurringId?: string | null;
}

const txRow = (t: TxWrite) => ({
  type: t.type,
  amount: Math.round(t.amount * 100) / 100,
  category_id: t.categoryId,
  date: t.date,
  note: t.note.slice(0, 200),
  payment_method: t.paymentMethod,
});

export async function insertTransaction(t: TxWrite): Promise<Transaction> {
  const row = { ...txRow(t), ...(t.id ? { id: t.id } : {}), ...(t.recurringId ? { recurring_rule_id: t.recurringId } : {}) };
  return toTx(must(await supabase.from('transactions').insert(row).select(TX_COLS).single()));
}

export async function updateTransaction(id: string, t: TxWrite): Promise<void> {
  must(await supabase.from('transactions').update(txRow(t)).eq('id', id));
}

export async function deleteTransactionRow(id: string): Promise<void> {
  must(await supabase.from('transactions').delete().eq('id', id));
}

// ---------- summaries (คำนวณใน Postgres) ----------
export async function fetchTotals(from?: ISODate, to?: ISODate): Promise<Totals & { count: number }> {
  const rows = must(await supabase.rpc('get_totals', { p_from: from ?? null, p_to: to ?? null })) as Row[];
  return toTotals(rows[0]);
}

export async function fetchMonthlySummary(from: ISODate, to: ISODate): Promise<MonthSummary[]> {
  const rows = must(await supabase.rpc('get_monthly_summary', { p_from: from, p_to: to })) as Row[];
  return rows.map((r) => ({ month: r.month as string, ...toTotals(r) }));
}

// ---------- recurring ----------
export async function fetchRecurring(): Promise<Recurring[]> {
  return must(await supabase.from('recurring_rules').select('*').order('created_at')).map(toRecurring);
}

export async function processRecurring(today: ISODate): Promise<number> {
  return num(must(await supabase.rpc('process_recurring', { p_today: today })));
}

export async function createRecurring(t: TxWrite, frequency: Frequency, today: ISODate): Promise<void> {
  must(
    await supabase.rpc('create_recurring_rule', {
      p_type: t.type,
      p_amount: Math.round(t.amount * 100) / 100,
      p_category_id: t.categoryId,
      p_date: t.date,
      p_note: t.note.slice(0, 200),
      p_payment_method: t.paymentMethod,
      p_frequency: frequency,
      p_today: today,
    }),
  );
}

export async function setRecurringActive(id: string, active: boolean): Promise<void> {
  must(await supabase.from('recurring_rules').update({ active }).eq('id', id));
}

export async function deleteRecurring(id: string): Promise<void> {
  must(await supabase.from('recurring_rules').delete().eq('id', id));
}

// ---------- budgets ----------
export async function fetchBudgets(month: ISODate): Promise<Budget[]> {
  const rows = must(await supabase.rpc('get_budgets', { p_month: month })) as Row[];
  return rows.map((r) => ({ categoryId: (r.category_id as string | null) ?? null, amount: num(r.amount), month: r.month as string }));
}

/** ตั้งงบตั้งแต่เดือนนี้เป็นต้นไป — amount null/0 = ยกเลิกงบหมวดนั้น */
export async function setBudgets(month: ISODate, items: { categoryId: string | null; amount: number | null }[]): Promise<void> {
  must(await supabase.rpc('set_budgets', { p_month: month, p_items: items.map((i) => ({ category_id: i.categoryId, amount: i.amount })) }));
}

// ---------- goals ----------
export async function fetchGoals(): Promise<Goal[]> {
  return must(await supabase.from('goals').select('*').order('created_at')).map(toGoal);
}

export type GoalInput = Pick<Goal, 'name' | 'target' | 'saved' | 'deadline' | 'icon' | 'color'>;

const goalRow = (g: GoalInput) => ({
  name: g.name.trim().slice(0, 60),
  target_amount: g.target,
  current_amount: g.saved,
  deadline: g.deadline || null,
  icon: g.icon,
  color: g.color,
});

export async function saveGoal(g: GoalInput, id?: string): Promise<void> {
  if (id) must(await supabase.from('goals').update(goalRow(g)).eq('id', id));
  else must(await supabase.from('goals').insert(goalRow(g)));
}

export async function restoreGoal(g: Goal): Promise<void> {
  must(await supabase.from('goals').insert({ id: g.id, ...goalRow(g) }));
}

export async function deleteGoal(id: string): Promise<void> {
  must(await supabase.from('goals').delete().eq('id', id));
}

export async function applyGoalDelta(id: string, delta: number): Promise<Goal | null> {
  const rows = must(await supabase.rpc('apply_goal_delta', { p_goal_id: id, p_delta: delta })) as Row[];
  return rows[0] ? toGoal(rows[0]) : null;
}

// ---------- ข้อมูลทั้งหมด (export / import / clear) ----------
export async function fetchAllForExport() {
  const all = async (table: string, order: string) => {
    const out: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      const rows = must(await supabase.from(table).select('*').order(order).order('id').range(from, from + PAGE - 1)) as Row[];
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  };
  const [transactions, categories, budgets, goals, recurring_rules] = await Promise.all([
    all('transactions', 'date'),
    all('categories', 'sort_order'),
    all('budgets', 'month'),
    all('goals', 'created_at'),
    all('recurring_rules', 'created_at'),
  ]);
  return { transactions, categories, budgets, goals, recurring_rules };
}

export interface ImportResult {
  transactions: number;
  skipped: number;
  categories: number;
}

export async function importData(payload: Row, mode: 'append' | 'replace'): Promise<ImportResult> {
  return must(await supabase.rpc('import_data', { p_payload: payload, p_mode: mode })) as ImportResult;
}

export async function clearMyData(confirm: string): Promise<void> {
  must(await supabase.rpc('clear_my_data', { p_confirm: confirm }));
}

// ---------- Edge Functions ----------
export async function invokeFunction<T = unknown>(name: string, body: Row): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // อ่านข้อความ error ภาษาไทยที่ฟังก์ชันส่งกลับมา
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? await ctx.json().then((j: { error?: string }) => j.error).catch(() => null) : null;
    throw Object.assign(new Error(msg ?? error.message), { code: undefined });
  }
  return data as T;
}
