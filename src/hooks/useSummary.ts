import { endOfMonth, startOfMonth, subMonths } from 'date-fns';
import { useMemo } from 'react';
import { periodRange, toISO, todayISO } from '../lib/date';
import { upcomingRecurringTotal } from '../lib/recurring';
import { avgDailyExpense, byCategory, forecastMonthEnd, percentChange, savingsRate, totals } from '../lib/stats';
import type { DateRange, Period } from '../types';
import { useCategories, useMonthlySummary, useRecurring, useTotals, useTxRange } from './useData';

/**
 * รวมตัวเลขสรุปของช่วงเวลาที่เลือก
 * - ยอดคงเหลือสะสม / เดือนนี้ / เดือนก่อน: คำนวณใน Postgres (get_totals, get_monthly_summary)
 * - สัดส่วนหมวด / เฉลี่ยต่อวัน / คาดการณ์: คำนวณจากรายการของช่วงที่เลือก
 */
export function useSummary(period: Period, custom?: DateRange) {
  const range = periodRange(period, custom);
  const monthRange = periodRange('month');
  const now = new Date();

  const categories = useCategories();
  const recurring = useRecurring().data;
  const rangeTx = useTxRange(range.start, range.end);
  // ต้องการรายการเดือนนี้เสมอสำหรับการคาดการณ์ (ถ้าเลือกช่วงอื่นอยู่)
  const monthTx = useTxRange(monthRange.start, monthRange.end);
  const balance = useTotals();
  const months = useMonthlySummary(toISO(startOfMonth(subMonths(now, 1))), toISO(startOfMonth(now)));

  const result = useMemo(() => {
    const list = rangeTx.data ?? [];
    const cur = totals(list, range);
    const [prevM, curM] = months.data ?? [];
    const month = curM ?? { income: 0, expense: 0, net: 0 };
    const prevMonth = prevM ?? { income: 0, expense: 0, net: 0 };
    const upcoming = upcomingRecurringTotal(recurring ?? [], todayISO(), toISO(endOfMonth(now)));
    const slices = byCategory(list, categories ?? [], range);
    return {
      current: cur,
      balance: balance.data?.net ?? 0,
      txCount: balance.data?.count ?? 0,
      savingsRate: savingsRate(cur),
      avgDaily: avgDailyExpense(cur, range),
      forecast: forecastMonthEnd(monthTx.data ?? [], upcoming),
      month,
      prevMonth,
      expenseChange: percentChange(month.expense, prevMonth.expense),
      incomeChange: percentChange(month.income, prevMonth.income),
      slices,
      top3: slices.slice(0, 3),
    };
  }, [rangeTx.data, monthTx.data, balance.data, months.data, categories, recurring, range.start, range.end]);

  return {
    ...result,
    range,
    transactions: rangeTx.data,
    loading: rangeTx.isPending || balance.isPending || months.isPending,
  };
}

export const PERIOD_LABEL: Record<Period, string> = {
  today: 'วันนี้',
  week: 'สัปดาห์นี้',
  month: 'เดือนนี้',
  year: 'ปีนี้',
  custom: 'กำหนดเอง',
};
