/** เลื่อนไปยัง section แบบนุ่ม (หรือกระโดดทันทีถ้าผู้ใช้ตั้งลดการเคลื่อนไหว) แล้วย้ายโฟกัสให้ screen reader */
export function scrollToId(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', `#${id}`);
  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

export const SECTIONS = [
  { id: 'how', label: 'วิธีใช้งาน' },
  { id: 'features', label: 'ฟีเจอร์' },
  { id: 'security', label: 'ความปลอดภัย' },
  { id: 'faq', label: 'คำถามที่พบบ่อย' },
] as const;
