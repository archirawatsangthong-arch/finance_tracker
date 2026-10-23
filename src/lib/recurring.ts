import { nthOccurrence } from './date';
import type { Recurring } from '../types';

// การสร้างรายการจากกฎรายการซ้ำทำใน Postgres (public.process_recurring) เพื่อกันสร้างซ้ำข้ามอุปกรณ์

/** ยอดรายจ่ายจากรายการซ้ำที่ยังไม่ถึงกำหนดภายในวันสิ้นเดือน (ใช้ในการคาดการณ์) */
export function upcomingRecurringTotal(list: Recurring[], afterDate: string, untilDate: string): number {
  let sum = 0;
  for (const r of list) {
    if (!r.active || r.type !== 'expense') continue;
    let n = r.occurrences;
    let d = r.nextDate;
    let guard = 0;
    while (d <= untilDate && guard++ < 62) {
      if (d > afterDate) sum += r.amount;
      n++;
      d = nthOccurrence(r.startDate, r.frequency, n);
    }
  }
  return sum;
}

export const FREQ_LABEL = { daily: 'รายวัน', weekly: 'รายสัปดาห์', monthly: 'รายเดือน' } as const;
