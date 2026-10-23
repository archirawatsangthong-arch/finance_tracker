import type { InfiniteData, QueryKey } from '@tanstack/react-query';
import * as api from './api';
import { todayISO } from './date';
import { errorMessage } from './errors';
import { invalidateMoney, qk, queryClient } from './queryClient';
import { toast, useUI } from '../store/ui';
import type { Budget, Frequency, MonthSummary, Totals, Transaction } from '../types';

export type TxInput = Omit<api.TxWrite, 'id'>;

// ===== optimistic update: แก้ cache ทันที แล้วค่อยยืนยันกับ server (rollback ถ้าล้มเหลว) =====

type Snapshot = [QueryKey, unknown][];

const MONEY_KEYS: QueryKey[] = [qk.tx, qk.totals, ['summary']];

async function snapshot(): Promise<Snapshot> {
  await Promise.all(MONEY_KEYS.map((queryKey) => queryClient.cancelQueries({ queryKey })));
  return MONEY_KEYS.flatMap((queryKey) => queryClient.getQueriesData({ queryKey }));
}

const restore = (s: Snapshot) => s.forEach(([key, data]) => queryClient.setQueryData(key, data));

const byNewest = (a: Transaction, b: Transaction) =>
  a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date);

const signed = (t: Transaction) => (t.type === 'income' ? t.amount : -t.amount);

/** ใส่/เอาออก รายการใน cache ทุกชุดที่เกี่ยวข้อง (รายการตามช่วง, ล่าสุด, ยอดรวม, สรุปรายเดือน, ผลค้นหา) */
function applyToCache(add: Transaction | null, remove: Transaction | null) {
  for (const [key, data] of queryClient.getQueriesData<unknown>({ queryKey: qk.tx })) {
    if (!data) continue;
    const kind = key[1];
    if (kind === 'range' && Array.isArray(data)) {
      const [, , start, end] = key as string[];
      let list = (data as Transaction[]).filter((t) => t.id !== remove?.id);
      if (add && add.date >= start && add.date <= end) list = [...list, add].sort(byNewest);
      queryClient.setQueryData(key, list);
    } else if (kind === 'recent' && Array.isArray(data)) {
      let list = (data as Transaction[]).filter((t) => t.id !== remove?.id);
      if (add) list = [...list, add].sort(byNewest).slice(0, Math.max(8, data.length));
      queryClient.setQueryData(key, list);
    } else if (kind === 'search' && remove) {
      // ผลค้นหา: เอาแถวที่ลบ/แก้ออกทันที (แถวใหม่จะมาหลัง refetch เพราะต้องผ่านตัวกรองฝั่ง server)
      const inf = data as InfiniteData<Transaction[]>;
      if (inf.pages) {
        queryClient.setQueryData(key, {
          ...inf,
          pages: inf.pages.map((p) => p.map((t) => (t.id === remove.id ? (add ?? null) : t)).filter(Boolean) as Transaction[]),
        });
      }
    }
  }

  for (const [key, data] of queryClient.getQueriesData<Totals & { count: number }>({ queryKey: qk.totals })) {
    if (!data) continue;
    const [, from, to] = key as (string | null)[];
    const inRange = (t: Transaction) => (!from || t.date >= from) && (!to || t.date <= to);
    const next = { ...data };
    for (const [t, sign] of [[remove, -1], [add, 1]] as const) {
      if (!t || !inRange(t)) continue;
      if (t.type === 'income') next.income += sign * t.amount;
      else next.expense += sign * t.amount;
      next.net += sign * signed(t);
      next.count += sign;
    }
    queryClient.setQueryData(key, next);
  }

  for (const [key, data] of queryClient.getQueriesData<MonthSummary[]>({ queryKey: ['summary'] })) {
    if (!data) continue;
    queryClient.setQueryData(
      key,
      data.map((m) => {
        const next = { ...m };
        for (const [t, sign] of [[remove, -1], [add, 1]] as const) {
          if (!t || t.date.slice(0, 7) !== m.month.slice(0, 7)) continue;
          if (t.type === 'income') next.income += sign * t.amount;
          else next.expense += sign * t.amount;
          next.net += sign * signed(t);
          next.count += sign;
        }
        return next;
      }),
    );
  }
}

const findCached = (id: string): Transaction | null => {
  for (const [, data] of queryClient.getQueriesData<unknown>({ queryKey: qk.tx })) {
    const list = Array.isArray(data) ? (data as Transaction[]) : ((data as InfiniteData<Transaction[]> | undefined)?.pages?.flat() ?? []);
    const hit = list.find((t) => t.id === id);
    if (hit) return hit;
  }
  return null;
};

/**
 * บันทึกรายการ — ขึ้นบนจอทันที (optimistic) ถ้า server ปฏิเสธจะย้อนกลับและมีปุ่ม "ลองใหม่"
 * ถ้าเลือกให้ซ้ำ จะรอ server สร้างกฎรายการซ้ำก่อน (throw เมื่อผิดพลาด)
 */
export async function saveTransaction(input: TxInput, opts: { id?: string; repeat?: Frequency | null } = {}): Promise<void> {
  if (opts.repeat && !opts.id) {
    // รายการซ้ำต้องสร้างกฎ + รายการที่ค้างใน server พร้อมกัน จึงรอผลก่อน
    await api.createRecurring(input, opts.repeat, todayISO());
    await Promise.all([invalidateMoney(), queryClient.invalidateQueries({ queryKey: qk.recurring })]);
    useUI.getState().fireCelebrate();
    toast(input.type === 'income' ? 'บันทึกรายรับแล้ว (ตั้งเป็นรายการซ้ำ)' : 'บันทึกรายจ่ายแล้ว (ตั้งเป็นรายการซ้ำ)');
    return;
  }

  const snap = await snapshot();
  const prev = opts.id ? findCached(opts.id) : null;
  const id = opts.id ?? crypto.randomUUID();
  const optimistic: Transaction = {
    ...input,
    id,
    recurringId: prev?.recurringId ?? null,
    createdAt: prev?.createdAt ?? new Date().toISOString(),
    pending: true,
  };
  // แก้ไขรายการที่ไม่อยู่ใน cache (กรณีหายาก) → ข้าม optimistic แล้วรอ server
  if (!opts.id || prev) applyToCache(optimistic, prev);

  if (!opts.id) {
    useUI.getState().fireCelebrate();
    toast(input.type === 'income' ? 'บันทึกรายรับแล้ว' : 'บันทึกรายจ่ายแล้ว');
  }

  try {
    if (opts.id) await api.updateTransaction(opts.id, input);
    else await api.insertTransaction({ ...input, id });
    if (opts.id) toast('แก้ไขรายการแล้ว');
    else void checkBudgetAlert(input);
  } catch (e) {
    restore(snap);
    toast(errorMessage(e, 'บันทึกไม่สำเร็จ'), {
      kind: 'error',
      duration: 6000,
      action: { label: 'ลองใหม่', onClick: () => void saveTransaction(input, opts) },
    });
  } finally {
    void invalidateMoney();
  }
}

/** ลบแล้วกด "เลิกทำ" ได้ภายในไม่กี่วินาที (ใส่กลับด้วย id เดิม) */
export async function deleteTransaction(tx: Transaction): Promise<void> {
  const snap = await snapshot();
  applyToCache(null, tx);
  try {
    await api.deleteTransactionRow(tx.id);
    toast('ลบรายการแล้ว', {
      kind: 'info',
      duration: 5000,
      action: {
        label: 'เลิกทำ',
        onClick: () => {
          applyToCache({ ...tx, pending: true }, null);
          api
            .insertTransaction({ ...tx })
            .then(() => toast('กู้คืนรายการแล้ว'))
            .catch((e) => toast(errorMessage(e, 'กู้คืนไม่สำเร็จ'), { kind: 'error' }))
            .finally(() => void invalidateMoney());
        },
      },
    });
  } catch (e) {
    restore(snap);
    toast(errorMessage(e, 'ลบไม่สำเร็จ'), { kind: 'error' });
  } finally {
    void invalidateMoney();
  }
}

/** แจ้งเตือนเมื่อใช้งบเกิน 90% หรือเกินงบ (ทั้งงบรวมและงบหมวด) */
async function checkBudgetAlert(tx: TxInput): Promise<void> {
  if (tx.type !== 'expense') return;
  const month = `${tx.date.slice(0, 7)}-01`;
  const [y, m] = tx.date.split('-').map(Number);
  const end = `${tx.date.slice(0, 7)}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  try {
    const budgets = await queryClient.fetchQuery({ queryKey: qk.budgets(month), queryFn: () => api.fetchBudgets(month) });
    const relevant = budgets.filter((b: Budget) => b.categoryId === null || b.categoryId === tx.categoryId);
    if (!relevant.length) return;
    const txs = await api.fetchTransactionsInRange(month, end);
    const cats = queryClient.getQueryData<{ id: string; name: string }[]>(qk.categories) ?? [];
    for (const b of relevant) {
      const spent = txs.filter((t) => t.type === 'expense' && (b.categoryId === null || t.categoryId === b.categoryId)).reduce((s, t) => s + t.amount, 0);
      const pct = (spent / b.amount) * 100;
      const label = b.categoryId === null ? 'งบรวม' : `งบ${cats.find((c) => c.id === b.categoryId)?.name ?? ''}`;
      if (pct > 100) toast(`${label}เกินแล้ว (${pct.toFixed(0)}%)`, { kind: 'error', duration: 5000 });
      else if (pct >= 90) toast(`${label}ใกล้เต็มแล้ว (${pct.toFixed(0)}%)`, { kind: 'warning', duration: 5000 });
    }
  } catch {
    // แจ้งเตือนงบเป็นแค่ส่วนเสริม ไม่ต้องรบกวนผู้ใช้ถ้าล้มเหลว
  }
}

/** ทำงานกับ server แล้ว refresh cache ที่เกี่ยวข้อง — แจ้ง error เป็นภาษาไทย */
export async function run<T>(fn: () => Promise<T>, opts: { success?: string; invalidate?: QueryKey[] } = {}): Promise<T | undefined> {
  try {
    const result = await fn();
    await Promise.all((opts.invalidate ?? []).map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    if (opts.success) toast(opts.success);
    return result;
  } catch (e) {
    toast(errorMessage(e), { kind: 'error' });
    return undefined;
  }
}
