import { invokeFunction } from './api';
import { supabase } from './supabase';
import type { Role } from '../types';

// ===== API หลังบ้าน — ทุกฟังก์ชันตรวจสิทธิ์ admin ในฐานข้อมูล/Edge Function อีกชั้น =====
// ไม่มีฟังก์ชันใดคืนรายการเงินรายบุคคล (เห็นเฉพาะสถิติรวม)

const n = (v: unknown) => Number(v ?? 0);

function must<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

export interface AdminOverview {
  totalUsers: number;
  newToday: number;
  newThisMonth: number;
  active7d: number;
  active30d: number;
  suspended: number;
  admins: number;
  totalTransactions: number;
  transactionsToday: number;
}

export async function fetchOverview(): Promise<AdminOverview> {
  const [r] = must(await supabase.rpc('admin_overview')) as Record<string, unknown>[];
  return {
    totalUsers: n(r?.total_users),
    newToday: n(r?.new_today),
    newThisMonth: n(r?.new_this_month),
    active7d: n(r?.active_7d),
    active30d: n(r?.active_30d),
    suspended: n(r?.suspended_users),
    admins: n(r?.admin_users),
    totalTransactions: n(r?.total_transactions),
    transactionsToday: n(r?.transactions_today),
  };
}

export async function fetchDaily(days: number) {
  const rows = must(await supabase.rpc('admin_daily_stats', { p_days: days })) as Record<string, unknown>[];
  return rows.map((r) => ({ day: r.day as string, newUsers: n(r.new_users), newTransactions: n(r.new_transactions) }));
}

export async function fetchMonthly(months: number) {
  const rows = must(await supabase.rpc('admin_monthly_stats', { p_months: months })) as Record<string, unknown>[];
  return rows.map((r) => ({ month: r.month as string, newUsers: n(r.new_users), totalUsers: n(r.total_users), newTransactions: n(r.new_transactions) }));
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: Role;
  isSuspended: boolean;
  provider: string;
  emailConfirmed: boolean;
  createdAt: string;
  lastSeenAt: string | null;
}

export async function listUsers(params: { query: string; role: Role | null; status: 'active' | 'suspended' | null; limit: number; offset: number }) {
  const rows = must(
    await supabase.rpc('admin_list_users', {
      p_query: params.query.trim() || null,
      p_role: params.role,
      p_status: params.status,
      p_limit: params.limit,
      p_offset: params.offset,
    }),
  ) as Record<string, unknown>[];
  return {
    total: n(rows[0]?.total_count),
    users: rows.map<AdminUser>((r) => ({
      id: r.id as string,
      email: (r.email as string) ?? '',
      displayName: (r.display_name as string) ?? '',
      avatarUrl: (r.avatar_url as string | null) ?? null,
      role: r.role as Role,
      isSuspended: Boolean(r.is_suspended),
      provider: (r.provider as string) ?? 'email',
      emailConfirmed: Boolean(r.email_confirmed),
      createdAt: r.created_at as string,
      lastSeenAt: (r.last_seen_at as string | null) ?? null,
    })),
  };
}

/** งานที่ต้องใช้สิทธิ์สูง → ผ่าน Edge Function (service key อยู่ฝั่ง server เท่านั้น) */
export const setSuspended = (userId: string, suspended: boolean) => invokeFunction('admin-users', { action: 'set_suspended', userId, suspended });

export const setRole = (userId: string, role: Role) => invokeFunction('admin-users', { action: 'set_role', userId, role });
