import { z } from 'zod';

// ===== schema ตรวจฟอร์ม (ข้อความ error ภาษาไทย) — ฐานข้อมูลตรวจซ้ำอีกชั้นด้วย CHECK constraint =====

const email = z.string().trim().min(1, 'กรุณากรอกอีเมล').max(254, 'อีเมลยาวเกินไป').pipe(z.email('รูปแบบอีเมลไม่ถูกต้อง'));

const password = z
  .string()
  .min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
  .max(72, 'รหัสผ่านยาวได้ไม่เกิน 72 ตัวอักษร')
  .regex(/[A-Za-z]/, 'รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษอย่างน้อย 1 ตัว')
  .regex(/\d/, 'รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
});

export const registerSchema = z
  .object({
    displayName: z.string().trim().min(1, 'กรุณากรอกชื่อที่ใช้แสดง').max(60, 'ชื่อยาวได้ไม่เกิน 60 ตัวอักษร'),
    email,
    password,
    confirm: z.string(),
    accept: z.literal(true, { error: 'กรุณายอมรับเงื่อนไขการใช้งาน' }),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' });

export const forgotSchema = z.object({ email });

export const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' });

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'กรุณากรอกชื่อที่ใช้แสดง').max(60, 'ชื่อยาวได้ไม่เกิน 60 ตัวอักษร'),
});

const money = (label: string, opts: { allowZero?: boolean } = {}) =>
  z
    .string()
    .trim()
    .min(1, `กรุณากรอก${label}`)
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), `${label}ต้องเป็นตัวเลขบวก ทศนิยมไม่เกิน 2 ตำแหน่ง`)
    .refine((v) => (opts.allowZero ? Number(v) >= 0 : Number(v) > 0), `${label}ต้องมากกว่า 0`)
    .refine((v) => Number(v) <= 9_999_999_999.99, `${label}มากเกินไป`);

export const goalSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาตั้งชื่อเป้าหมาย').max(60, 'ชื่อยาวได้ไม่เกิน 60 ตัวอักษร'),
  target: money('ยอดเป้าหมาย'),
  saved: z.union([z.literal(''), money('ยอดที่ออมแล้ว', { allowZero: true })]),
  deadline: z.string(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'กรุณาใส่ชื่อหมวดหมู่').max(40, 'ชื่อยาวได้ไม่เกิน 40 ตัวอักษร'),
  keywords: z.string().max(1000, 'คำค้นยาวเกินไป'),
});

/** ตรวจจำนวนเงินจากช่องกรอกทั่วไป (งบ, เติมเงินเป้าหมาย) */
export const parseMoney = (v: string): number | null => {
  const s = v.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n <= 9_999_999_999.99 ? n : null;
};

/** วัดความแข็งแรงของรหัสผ่าน 0–4 (ใช้แสดงแถบสี) */
export function passwordStrength(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
