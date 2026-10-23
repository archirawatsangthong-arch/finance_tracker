import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from '../store/ui';
import { errorMessage, isNetworkError } from './errors';

/** ไม่ retry error ฝั่งผู้ใช้ (สิทธิ์ไม่พอ, ข้อมูลผิด) — retry เฉพาะปัญหาเครือข่าย/เซิร์ฟเวอร์ */
const shouldRetry = (count: number, error: unknown): boolean => {
  const status = (error as { status?: number })?.status;
  const code = (error as { code?: string })?.code ?? '';
  if (status && status >= 400 && status < 500) return false;
  if (/^(42|22|23|P0|PGRST)/.test(code)) return false;
  return count < 3;
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // แจ้งเตือนเฉพาะตอนดึงข้อมูลไม่สำเร็จหลัง retry ครบแล้ว
      if (query.meta?.silent) return;
      toast(errorMessage(error, 'โหลดข้อมูลไม่สำเร็จ'), {
        kind: 'error',
        action: { label: 'ลองใหม่', onClick: () => void queryClient.refetchQueries({ type: 'active', stale: true }) },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _v, _c, mutation) => {
      if (mutation.meta?.silent) return;
      toast(errorMessage(error, 'บันทึกไม่สำเร็จ'), { kind: 'error' });
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: shouldRetry,
      retryDelay: (n) => Math.min(1000 * 2 ** n, 15_000),
      refetchOnWindowFocus: true,
      // หยุดรอเมื่อออฟไลน์ แล้วดึงต่อเองเมื่อเน็ตกลับมา
      networkMode: 'online',
    },
    mutations: {
      // บันทึกค้างไว้ตอนออฟไลน์ แล้วส่งต่อเมื่อออนไลน์
      networkMode: 'online',
      retry: (count, error) => isNetworkError(error) && count < 3,
    },
  },
});

/** query key ทั้งหมดของแอป — ทุก key อยู่ใต้ข้อมูลของผู้ใช้ที่ล็อกอิน (ล้างเมื่อออกจากระบบ) */
export const qk = {
  profile: (uid: string) => ['profile', uid] as const,
  categories: ['categories'] as const,
  tx: ['tx'] as const,
  txRange: (start: string, end: string) => ['tx', 'range', start, end] as const,
  txRecent: ['tx', 'recent'] as const,
  txSearch: (f: unknown) => ['tx', 'search', f] as const,
  txSearchTotals: (f: unknown) => ['tx', 'searchTotals', f] as const,
  totals: ['totals'] as const,
  summary: (from: string, to: string) => ['summary', from, to] as const,
  budgets: (month: string) => ['budgets', month] as const,
  goals: ['goals'] as const,
  recurring: ['recurring'] as const,
  admin: ['admin'] as const,
};

/** ข้อมูลที่ได้รับผลกระทบเมื่อรายการเงินเปลี่ยน */
export const invalidateMoney = () =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.tx }),
    queryClient.invalidateQueries({ queryKey: qk.totals }),
    queryClient.invalidateQueries({ queryKey: ['summary'] }),
  ]);
