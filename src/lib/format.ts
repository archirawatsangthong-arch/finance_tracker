import type { Currency, Era } from '../store/settings';
import type { ISODate } from '../types';
import { fromISO } from './date';

const LOCALE: Record<Currency, string> = { THB: 'th-TH', USD: 'en-US', EUR: 'de-DE', JPY: 'ja-JP' };

const moneyCache = new Map<string, Intl.NumberFormat>();

/** จัดรูปแบบเงิน เช่น ฿1,234.50 */
export function formatMoney(value: number, currency: Currency = 'THB', opts: { sign?: boolean; compact?: boolean } = {}): string {
  const key = `${currency}-${opts.compact ? 'c' : 'f'}`;
  let nf = moneyCache.get(key);
  if (!nf) {
    nf = new Intl.NumberFormat(LOCALE[currency], {
      style: 'currency',
      currency,
      notation: opts.compact ? 'compact' : 'standard',
      minimumFractionDigits: opts.compact || currency === 'JPY' ? 0 : 2,
      maximumFractionDigits: opts.compact ? 1 : currency === 'JPY' ? 0 : 2,
    });
    moneyCache.set(key, nf);
  }
  const text = nf.format(Math.abs(value));
  if (opts.sign) return `${value < 0 ? '−' : '+'}${text}`;
  return value < 0 ? `−${text}` : text;
}

export const formatPercent = (value: number, digits = 1): string =>
  `${Number.isFinite(value) ? value.toFixed(digits) : '0'}%`;

export const MASK = '****';

const locale = (era: Era) => (era === 'BE' ? 'th-TH-u-ca-buddhist' : 'th-TH-u-ca-gregory');

/** แสดงวันที่แบบไทย เลือก พ.ศ./ค.ศ. ได้ */
export function formatDate(date: ISODate | Date, era: Era, style: 'long' | 'short' | 'day' | 'month' | 'monthShort' = 'short'): string {
  const d = typeof date === 'string' ? fromISO(date) : date;
  const options: Record<typeof style, Intl.DateTimeFormatOptions> = {
    long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    short: { day: 'numeric', month: 'short', year: '2-digit' },
    day: { weekday: 'short', day: 'numeric', month: 'short' },
    month: { month: 'long', year: 'numeric' },
    monthShort: { month: 'short' },
  };
  return new Intl.DateTimeFormat(locale(era), options[style]).format(d);
}
