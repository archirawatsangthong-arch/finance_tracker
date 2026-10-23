import * as api from './api';
import { paymentLabel } from './categories';

// ===== Export / Import ข้อมูลของผู้ใช้ที่ล็อกอินอยู่ =====
// การตรวจสอบและบันทึกจริงทำในฐานข้อมูล (public.import_data) — ฝั่งนี้แค่แปลงไฟล์

const download = (content: string, filename: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const stamp = () => new Date().toISOString().slice(0, 10);

export interface BackupFile {
  app: 'coinly';
  version: 2;
  exportedAt: string;
  transactions: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  budgets: Record<string, unknown>[];
  goals: Record<string, unknown>[];
  recurring_rules: Record<string, unknown>[];
}

// เอาคอลัมน์ระบบออก (user_id ฯลฯ) — ไฟล์ย้ายไปบัญชีอื่นได้
const strip = (rows: Record<string, unknown>[]) =>
  rows.map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'user_id' && k !== 'updated_at')));

export async function exportJSON(): Promise<void> {
  const data = await api.fetchAllForExport();
  const file: BackupFile = {
    app: 'coinly',
    version: 2,
    exportedAt: new Date().toISOString(),
    transactions: strip(data.transactions),
    categories: strip(data.categories),
    budgets: strip(data.budgets),
    goals: strip(data.goals),
    recurring_rules: strip(data.recurring_rules),
  };
  download(JSON.stringify(file, null, 2), `coinly-backup-${stamp()}.json`, 'application/json');
}

// ===== CSV =====
const CSV_HEADER = ['date', 'type', 'amount', 'category', 'note', 'paymentMethod'] as const;

/** escape ค่าใน CSV และกัน CSV/formula injection เมื่อเปิดใน Excel */
const csvCell = (v: string | number): string => {
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function exportCSV(): Promise<void> {
  const { transactions, categories } = await api.fetchAllForExport();
  const name = new Map(categories.map((c) => [c.id as string, c.name as string]));
  const rows = transactions.map((t) =>
    [t.date as string, t.type as string, Number(t.amount), name.get(t.category_id as string) ?? '', (t.note as string) ?? '', t.payment_method as string]
      .map(csvCell)
      .join(','),
  );
  // ใส่ BOM เพื่อให้ Excel อ่านภาษาไทยถูกต้อง
  download('﻿' + [CSV_HEADER.join(','), ...rows].join('\r\n'), `coinly-transactions-${stamp()}.csv`, 'text/csv;charset=utf-8');
}

/** แยก CSV ที่รองรับเครื่องหมายคำพูดและขึ้นบรรทัดใหม่ในช่อง */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const PAYMENT_BY_LABEL: Record<string, string> = Object.fromEntries(
  ['cash', 'card', 'transfer', 'qr', 'ewallet'].map((id) => [paymentLabel(id), id]),
);

/** แปลง CSV เป็น payload ของ import_data (แถวที่ผิดจะถูกข้ามในฐานข้อมูล) */
export function csvToPayload(text: string) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('ไฟล์ CSV ว่างเปล่า');
  const header = rows[0].map((h) => h.trim().replace(/^﻿/, ''));
  const col = (k: string) => header.indexOf(k);
  if (col('date') < 0 || col('amount') < 0) throw new Error('ไม่พบคอลัมน์ date หรือ amount');
  if (rows.length - 1 > 50_000) throw new Error('นำเข้าได้ครั้งละไม่เกิน 50,000 รายการ');
  const unquote = (s: string | undefined) => (s ?? '').trim().replace(/^'/, '');
  return {
    transactions: rows.slice(1).map((r) => {
      const pm = unquote(r[col('paymentMethod')]);
      return {
        date: unquote(r[col('date')]),
        type: unquote(r[col('type')]) === 'income' ? 'income' : 'expense',
        amount: unquote(r[col('amount')]).replace(/[,\s฿]/g, '').replace(/^-/, ''),
        category_name: unquote(r[col('category')]).slice(0, 40),
        note: unquote(r[col('note')]).slice(0, 200),
        payment_method: PAYMENT_BY_LABEL[pm] ?? pm,
      };
    }),
  };
}

export async function importCSV(text: string): Promise<api.ImportResult> {
  return api.importData(csvToPayload(text), 'append');
}

/** นำเข้า JSON: ตรวจรูปแบบไฟล์ แล้วแทนที่ข้อมูลทั้งหมดของบัญชีนี้ */
export async function importJSON(text: string): Promise<api.ImportResult> {
  let data: Partial<BackupFile> & { app?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('ไฟล์ JSON ไม่ถูกต้อง');
  }
  if (data?.app !== 'coinly' || !Array.isArray(data.transactions)) throw new Error('ไม่ใช่ไฟล์สำรองของ Coinly');
  if (data.version !== 2) return api.importData(fromV1(data as unknown as V1Backup), 'replace');
  return api.importData(
    {
      transactions: data.transactions,
      categories: data.categories ?? [],
      budgets: data.budgets ?? [],
      goals: data.goals ?? [],
      recurring_rules: data.recurring_rules ?? [],
    },
    'replace',
  );
}

// ===== ไฟล์สำรองจาก Coinly เวอร์ชันออฟไลน์ (v1, IndexedDB) =====
type R = Record<string, unknown>;
interface V1Backup {
  transactions: R[];
  categories?: R[];
  budgets?: R[];
  goals?: R[];
  recurring?: R[];
}

/** แปลงชื่อฟิลด์ v1 (camelCase) เป็นรูปแบบที่ import_data รับ */
function fromV1(d: V1Backup) {
  const month = `${new Date().toISOString().slice(0, 7)}-01`;
  return {
    categories: (d.categories ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      icon: c.icon,
      color: c.color,
      keywords: c.keywords,
      sort_order: c.order,
      system_key: c.id === 'other-expense' ? 'other_expense' : c.id === 'other-income' ? 'other_income' : null,
    })),
    transactions: d.transactions.map((t) => ({
      type: t.type,
      amount: t.amount,
      category_id: t.categoryId,
      date: t.date,
      note: t.note,
      payment_method: t.paymentMethod,
      recurring_rule_id: t.recurringId,
    })),
    recurring_rules: (d.recurring ?? []).map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amount,
      category_id: r.categoryId,
      note: r.note,
      payment_method: r.paymentMethod,
      frequency: r.frequency,
      start_date: r.startDate,
      occurrences: r.occurrences,
      next_run_date: r.nextDate,
      active: r.active,
    })),
    budgets: (d.budgets ?? []).map((b) => ({ category_id: b.id === 'all' ? null : b.id, amount: b.amount, month })),
    goals: (d.goals ?? []).map((g) => ({
      name: g.name,
      target_amount: g.target,
      current_amount: g.saved,
      deadline: g.deadline,
      icon: g.icon,
      color: g.color,
    })),
  };
}
