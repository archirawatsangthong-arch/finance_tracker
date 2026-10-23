/** หน้าแรกของแอปหลังล็อกอิน */
export const APP_HOME = '/app';

/**
 * รับเฉพาะ path ภายในแอป กัน open redirect (เช่น ?next=//evil.com หรือ https://...)
 * ค่าเริ่มต้น/ค่าที่ไม่ปลอดภัย → /app
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return APP_HOME;
  if (next === '/' || /^\/(login|register|forgot-password|reset-password|auth\/)/.test(next)) return APP_HOME;
  return next;
}
