// ===== โมเดลข้อมูลหลักของแอป (camelCase — แปลงจาก snake_case ของฐานข้อมูลใน lib/api.ts) =====

export type TxType = 'income' | 'expense';

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'qr' | 'ewallet';

export type Frequency = 'daily' | 'weekly' | 'monthly';

export type Role = 'user' | 'admin';

/** วันที่รูปแบบ yyyy-MM-dd (ตรงกับชนิด date ของ Postgres) */
export type ISODate = string;

export interface Profile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  currency: 'THB' | 'USD' | 'EUR' | 'JPY';
  theme: 'dark' | 'light';
  useBuddhistYear: boolean;
  role: Role;
  isSuspended: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  categoryId: string;
  date: ISODate;
  note: string;
  paymentMethod: PaymentMethod;
  recurringId: string | null;
  createdAt: string;
  /** true = ยังบันทึกไม่ถึง server (optimistic update) */
  pending?: boolean;
}

export interface Category {
  id: string;
  name: string;
  type: TxType;
  icon: string;
  color: string;
  /** คำที่ใช้จับคู่ตอนพิมพ์ภาษาธรรมชาติ เช่น "กาแฟ" → อาหาร */
  keywords: string[];
  order: number;
  /** หมวดสำรองที่ลบไม่ได้ */
  systemKey: 'other_expense' | 'other_income' | null;
}

export interface Budget {
  /** null = งบรวมทั้งเดือน */
  categoryId: string | null;
  amount: number;
  /** เดือนที่เริ่มมีผล (วันที่ 1) */
  month: ISODate;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  deadline: ISODate | null;
  icon: string;
  color: string;
  createdAt: string;
}

export interface Recurring {
  id: string;
  type: TxType;
  amount: number;
  categoryId: string;
  note: string;
  paymentMethod: PaymentMethod;
  frequency: Frequency;
  startDate: ISODate;
  occurrences: number;
  nextDate: ISODate;
  active: boolean;
}

export type Period = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface DateRange {
  start: ISODate;
  end: ISODate;
}

export interface Totals {
  income: number;
  expense: number;
  net: number;
}

export interface MonthSummary extends Totals {
  month: ISODate;
  count: number;
}

export interface TxFilters {
  query: string;
  type: TxType | 'all';
  categories: string[];
  start: string;
  end: string;
  min: string;
  max: string;
}
