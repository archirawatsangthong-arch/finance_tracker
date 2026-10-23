import { describe, expect, it } from 'vitest';
import { FLY_SPAN, flyK, flyLocal, flyState } from './progress';

describe('flyState (หยอดลงกระปุก)', () => {
  it('เริ่มนอกฉาก มองไม่เห็น', () => {
    const s = flyState(0);
    expect(s.travel).toBe(0);
    expect(s.opacity).toBe(0);
  });

  it('ถึงช่องหยอดก่อนเริ่มจม และยังมองเห็นชัด', () => {
    const s = flyState(0.8);
    expect(s.travel).toBeCloseTo(1);
    expect(s.sink).toBe(0);
    expect(s.opacity).toBeCloseTo(1);
  });

  it('จบแล้วย่อเหลือ 0 และจางหายหมด', () => {
    const s = flyState(1);
    expect(s.sink).toBe(1);
    expect(s.scale).toBe(0);
    expect(s.opacity).toBe(0);
  });

  it('ช่วงจม: จางเร็วกว่าย่อ', () => {
    const s = flyState(0.9);
    expect(s.opacity).toBeLessThan(s.scale);
  });
});

describe('flyLocal / flyK (ผูกกับ scroll)', () => {
  it('ทำงานในช่วง p = i-0.4 .. i และจบครบตอนการ์ดอยู่กลางจอ', () => {
    expect(flyLocal(1.5, 2)).toBe(0);
    expect(flyLocal(2, 2)).toBe(1);
    expect(flyLocal(4, 4)).toBe(1);
  });

  it('ชิ้นที่ delay มากที่สุดยังจมเสร็จภายในขั้น', () => {
    expect(flyK(1, 1 - FLY_SPAN)).toBe(1);
    expect(flyK(1, 0.45)).toBe(1);
  });

  it('ย้อน scroll กลับได้ (ฟังก์ชันบริสุทธิ์ของ progress)', () => {
    expect(flyState(flyK(flyLocal(3.8, 4), 0)).opacity).toBe(flyState(flyK(flyLocal(3.8, 4), 0)).opacity);
  });
});
