// ความคืบหน้าของ tutorial แบบต่อเนื่อง (0 → STEP_COUNT-1) ที่ GSAP ScrollTrigger เขียน และฉาก 3D อ่านใน useFrame
// เก็บใน object ธรรมดา (ไม่ใช่ React state) เพื่อไม่ให้ re-render ทุกครั้งที่เลื่อนหน้าจอ

export const tutorialProgress = { target: 0 };

/**
 * น้ำหนัก 0..1 ของขั้น i จาก progress p — 1 เมื่ออยู่ตรงขั้นนั้นพอดี
 * จางหายภายใน ~0.6 ขั้น เพื่อให้ขั้นข้างเคียงซ้อนกันแค่ช่วงสั้น ๆ ตรงกลางระหว่างการ์ด
 */
export const stepWeight = (p: number, i: number): number => Math.max(0, 1 - Math.abs(p - i) * 1.6);

/**
 * ความคืบหน้าภายในขั้น i (0..1) — เริ่มเมื่อการ์ดเข้ามาครึ่งทาง และเต็ม 1 ก่อนการ์ดถึงกลางจอเล็กน้อย
 * (การ์ดอยู่กลางจอ = p เท่ากับ i พอดี → แอนิเมชันของขั้นนั้นต้องเสร็จแล้ว)
 */
export const stepLocal = (p: number, i: number): number => Math.min(1, Math.max(0, (p - i + 0.5) / 0.42));

export const smooth = (t: number): number => t * t * (3 - 2 * t);

export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/**
 * ความคืบหน้าของแอนิเมชัน "หยอดลงกระปุก" ในขั้น i (0..1) ผูกกับการ scroll โดยตรง
 * เริ่มเมื่อขั้นนั้นปรากฏชัดพอ (p = i - 0.4) และจบพอดีตอนการ์ดอยู่กลางจอ (p = i) → ค้างที่ขั้นสุดท้ายก็ยังเห็นผลครบ
 */
export const flyLocal = (p: number, i: number): number => clamp01((p - i + 0.4) / 0.4);

/** ช่วงของ flyLocal ที่วัตถุหนึ่งชิ้นใช้ตั้งแต่ปรากฏจนจมลงกระปุก */
export const FLY_SPAN = 0.55;

/** ความคืบหน้าของวัตถุชิ้นหนึ่ง (k ของ flyState) — delay ทำให้หยอดทีละชิ้นตามการเลื่อน */
export const flyK = (local: number, delay: number): number => clamp01((local - delay) / FLY_SPAN);

export interface FlyState {
  /** ระยะทางบนเส้นโค้งจากจุดเริ่มถึงช่องหยอด (0..1) */
  travel: number;
  /** ช่วงจมลงช่องหยอด (0..1) — ย่อขนาดและจางหายไปพร้อมกัน */
  sink: number;
  opacity: number;
  scale: number;
}

/**
 * สถานะของวัตถุที่ "หยอดลงกระปุก" ณ ความคืบหน้า k (0..1, ผูกกับการ scroll)
 * - 0..0.12 ค่อย ๆ ปรากฏจากด้านนอก
 * - 0..0.8 พุ่งตามเส้นโค้งเข้าหาช่องหยอด
 * - 0.8..1 จมลงช่อง: ย่อเหลือ 0 และจางหาย (จางเร็วกว่าย่อเล็กน้อย ให้ดูเหมือนถูกกลืน)
 */
export function flyState(k: number): FlyState {
  const travel = smooth(clamp01(k / 0.8));
  const sink = smooth(clamp01((k - 0.8) / 0.2));
  const appear = smooth(clamp01(k / 0.12));
  const left = 1 - sink;
  return { travel, sink, opacity: appear * left * left, scale: (0.55 + 0.45 * appear) * left };
}
