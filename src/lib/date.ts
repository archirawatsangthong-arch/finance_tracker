import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
} from 'date-fns';
import type { DateRange, Frequency, ISODate, Period } from '../types';

export const toISO = (d: Date): ISODate => format(d, 'yyyy-MM-dd');
export const fromISO = (s: ISODate): Date => parseISO(s);
export const todayISO = (): ISODate => toISO(new Date());

/** แปลงช่วงเวลา (วันนี้/สัปดาห์/เดือน/ปี) เป็นวันเริ่ม-สิ้นสุด — สัปดาห์เริ่มวันจันทร์ */
export function periodRange(period: Period, custom?: DateRange, ref = new Date()): DateRange {
  switch (period) {
    case 'today':
      return { start: toISO(ref), end: toISO(ref) };
    case 'week':
      return { start: toISO(startOfWeek(ref, { weekStartsOn: 1 })), end: toISO(endOfWeek(ref, { weekStartsOn: 1 })) };
    case 'month':
      return { start: toISO(startOfMonth(ref)), end: toISO(endOfMonth(ref)) };
    case 'year':
      return { start: toISO(startOfYear(ref)), end: toISO(endOfYear(ref)) };
    case 'custom':
      return custom ?? { start: toISO(startOfMonth(ref)), end: toISO(ref) };
  }
}

export const prevMonthRange = (ref = new Date()): DateRange => {
  const p = subMonths(ref, 1);
  return { start: toISO(startOfMonth(p)), end: toISO(endOfMonth(p)) };
};

export const inRange = (date: ISODate, r: DateRange): boolean => date >= r.start && date <= r.end;

/** จำนวนวันในช่วง (นับรวมวันแรกและวันสุดท้าย) */
export const daysBetween = (start: ISODate, end: ISODate): number =>
  differenceInCalendarDays(fromISO(end), fromISO(start)) + 1;

/** วันที่ของรายการซ้ำครั้งที่ n (นับจาก startDate) — คำนวณจากจุดเริ่มเสมอเพื่อไม่ให้วันเลื่อน */
export function nthOccurrence(startDate: ISODate, frequency: Frequency, n: number): ISODate {
  const s = fromISO(startDate);
  if (frequency === 'daily') return toISO(addDays(s, n));
  if (frequency === 'weekly') return toISO(addWeeks(s, n));
  return toISO(addMonths(s, n));
}
