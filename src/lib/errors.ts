// แปลง error จาก Supabase / เครือข่าย เป็นข้อความภาษาไทยที่ผู้ใช้เข้าใจ

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  email_not_confirmed: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ (ตรวจสอบกล่องจดหมาย)',
  user_already_exists: 'อีเมลนี้ถูกใช้สมัครแล้ว',
  email_exists: 'อีเมลนี้ถูกใช้สมัครแล้ว',
  weak_password: 'รหัสผ่านไม่ปลอดภัยพอ ลองใช้รหัสที่ยาวขึ้นหรือผสมตัวอักษรหลายแบบ',
  same_password: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม',
  over_email_send_rate_limit: 'ส่งอีเมลบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
  over_request_rate_limit: 'ทำรายการบ่อยเกินไป กรุณารอสักครู่',
  user_banned: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ',
  otp_expired: 'ลิงก์หมดอายุแล้ว กรุณาขอลิงก์ใหม่',
  session_not_found: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
  reauthentication_needed: 'กรุณาเข้าสู่ระบบใหม่ก่อนเปลี่ยนรหัสผ่าน',
  signup_disabled: 'ปิดรับสมัครสมาชิกชั่วคราว',
  provider_disabled: 'ยังไม่ได้เปิดใช้การเข้าสู่ระบบด้วยวิธีนี้',
  validation_failed: 'ข้อมูลไม่ถูกต้อง',
};

interface MaybeError {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

export const isNetworkError = (e: unknown): boolean => {
  const err = e as MaybeError | null;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const m = err?.message ?? '';
  return /Failed to fetch|NetworkError|Load failed|network|fetch failed/i.test(m) || err?.name === 'AuthRetryableFetchError';
};

export function errorMessage(e: unknown, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่'): string {
  if (!e) return fallback;
  if (isNetworkError(e)) return 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ กรุณาตรวจสอบเครือข่าย';
  const err = e as MaybeError;
  if (err.code && AUTH_MESSAGES[err.code]) return AUTH_MESSAGES[err.code];
  // Postgres error codes
  if (err.code === '42501') return err.message && /[฀-๿]/.test(err.message) ? err.message : 'ไม่มีสิทธิ์ทำรายการนี้';
  if (err.code === '23514') return 'ข้อมูลไม่ผ่านการตรวจสอบ (เช่น จำนวนเงินต้องมากกว่า 0)';
  if (err.code === '23505') return 'มีข้อมูลนี้อยู่แล้ว (ชื่อซ้ำ)';
  if (err.code === '23503') return 'ข้อมูลอ้างอิงไม่ถูกต้อง (เช่น หมวดหมู่ถูกลบไปแล้ว)';
  if (err.code === 'PGRST301' || err.status === 401) return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
  // ข้อความภาษาไทยที่มาจากฟังก์ชันในฐานข้อมูล / Edge Function
  if (err.message && /[฀-๿]/.test(err.message)) return err.message;
  return fallback;
}
