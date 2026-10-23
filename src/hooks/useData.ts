import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import * as api from '../lib/api';
import { qk } from '../lib/queryClient';
import { useAuth } from '../store/auth';
import type { Category, ISODate, TxFilters } from '../types';

// ข้อมูลทั้งหมดดึงผ่าน TanStack Query — data = undefined หมายถึงกำลังโหลด (ใช้แสดง skeleton)

export const useUserId = (): string | null => useAuth((s) => s.user?.id ?? null);

export function useProfile() {
  const uid = useUserId();
  return useQuery({ queryKey: qk.profile(uid ?? ''), queryFn: () => api.fetchProfile(uid!), enabled: !!uid, staleTime: 5 * 60_000 });
}

export function useCategories(): Category[] | undefined {
  return useQuery({ queryKey: qk.categories, queryFn: api.fetchCategories, staleTime: 5 * 60_000 }).data;
}

export function useCategoryMap(): Map<string, Category> {
  const cats = useCategories();
  return useMemo(() => new Map((cats ?? []).map((c) => [c.id, c])), [cats]);
}

/** รายการทั้งหมดในช่วงวันที่ (ใช้คำนวณสถิติของช่วงนั้น) */
export function useTxRange(start: ISODate, end: ISODate) {
  return useQuery({
    queryKey: qk.txRange(start, end),
    queryFn: () => api.fetchTransactionsInRange(start, end),
    placeholderData: keepPreviousData,
  });
}

export function useRecentTx(limit = 8) {
  return useQuery({ queryKey: qk.txRecent, queryFn: () => api.fetchRecentTransactions(limit) });
}

/** ยอดรวม (ไม่ส่งช่วง = ตั้งแต่เริ่มบันทึก) — คำนวณใน Postgres */
export function useTotals(from?: ISODate, to?: ISODate) {
  return useQuery({ queryKey: [...qk.totals, from ?? null, to ?? null], queryFn: () => api.fetchTotals(from, to) });
}

export function useMonthlySummary(from: ISODate, to: ISODate) {
  return useQuery({ queryKey: qk.summary(from, to), queryFn: () => api.fetchMonthlySummary(from, to) });
}

export function useBudgets(month: ISODate) {
  return useQuery({ queryKey: qk.budgets(month), queryFn: () => api.fetchBudgets(month) });
}

export function useGoals() {
  return useQuery({ queryKey: qk.goals, queryFn: api.fetchGoals });
}

export function useRecurring() {
  return useQuery({ queryKey: qk.recurring, queryFn: api.fetchRecurring });
}

const SEARCH_PAGE = 50;

/** ค้นหาฝั่ง server แบบโหลดเพิ่มทีละหน้า */
export function useTxSearch(filters: TxFilters) {
  return useInfiniteQuery({
    queryKey: qk.txSearch(filters),
    queryFn: ({ pageParam }) => api.searchTransactions(filters, pageParam, SEARCH_PAGE),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length < SEARCH_PAGE ? undefined : all.length * SEARCH_PAGE),
    placeholderData: keepPreviousData,
  });
}

export function useTxSearchTotals(filters: TxFilters) {
  return useQuery({ queryKey: qk.txSearchTotals(filters), queryFn: () => api.searchTotals(filters), placeholderData: keepPreviousData });
}
