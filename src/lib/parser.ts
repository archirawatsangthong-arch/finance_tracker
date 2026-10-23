import type { Category, TxType } from '../types';
import { tryEvaluate } from './calculator';

export interface ParsedInput {
  amount: number | null;
  type: TxType | null;
  categoryId: string | null;
  note: string;
}

const INCOME_HINTS = ['เงินเดือน', 'รายรับ', 'ได้เงิน', 'รับเงิน', 'โบนัส', 'ปันผล', 'ขายของ', 'ค่าจ้าง', 'income'];

/**
 * แยกข้อความภาษาธรรมชาติ เช่น
 *  "กาแฟ 65"           → รายจ่าย 65 หมวดอาหาร
 *  "เงินเดือน +35000"   → รายรับ 35,000 หมวดเงินเดือน
 *  "grab 120+45"       → รายจ่าย 165 หมวดเดินทาง
 */
export function parseNaturalInput(text: string, categories: Category[]): ParsedInput {
  const raw = text.trim();
  if (!raw) return { amount: null, type: null, categoryId: null, note: '' };

  // หา "ก้อนตัวเลข" ที่อาจมีเครื่องหมายคิดเลข เช่น +35,000 หรือ 120+45*2
  // ใช้ก้อนสุดท้ายเป็นจำนวนเงิน เพื่อให้ "7-11 ซื้อน้ำ 25" ได้ 25 ไม่ใช่ 7-11
  const all = [...raw.matchAll(/([+-]?\s*\d[\d,]*(?:\.\d+)?(?:\s*[+\-*/×x÷]\s*\d[\d,]*(?:\.\d+)?)*)\s*(บาท|฿|บ\.?|k|K)?/g)];
  const match = all.at(-1);
  let amount: number | null = null;
  let explicitSign: TxType | null = null;
  let note = raw;

  if (match) {
    const expr = match[1].replace(/\s+/g, '');
    if (expr.startsWith('+')) explicitSign = 'income';
    if (expr.startsWith('-')) explicitSign = 'expense';
    const value = tryEvaluate(expr.replace(/^[+-]/, ''));
    if (value !== null) amount = Math.abs(value) * (match[2] && /k/i.test(match[2]) ? 1000 : 1);
    note = (raw.slice(0, match.index) + ' ' + raw.slice((match.index ?? 0) + match[0].length)).replace(/\s+/g, ' ').trim();
  }

  // จับคู่หมวดหมู่จาก keyword ที่ยาวที่สุดก่อน (เช่น "ค่าไฟ" ชนะ "ไฟ")
  const lower = note.toLowerCase();
  let best: { cat: Category; len: number } | null = null;
  for (const cat of categories) {
    for (const kw of [cat.name, ...cat.keywords]) {
      const k = kw.toLowerCase();
      if (k && lower.includes(k) && (!best || k.length > best.len)) best = { cat, len: k.length };
    }
  }

  let type: TxType | null = explicitSign;
  if (!type && best) type = best.cat.type;
  if (!type && INCOME_HINTS.some((h) => lower.includes(h))) type = 'income';
  if (!type && amount !== null) type = 'expense';

  // ถ้าหมวดที่เจอไม่ตรงกับประเภทที่ผู้ใช้ระบุด้วยเครื่องหมาย ให้ทิ้งหมวดนั้น
  const categoryId = best && (!type || best.cat.type === type) ? best.cat.id : null;

  return { amount, type, categoryId, note };
}
