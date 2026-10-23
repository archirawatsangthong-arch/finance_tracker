import { useEffect, useState, type RefObject } from 'react';

/**
 * ติดตามว่า element อยู่ในจอหรือไม่
 * - mounted: เคยเข้าใกล้จอแล้ว (ใช้ lazy mount ฉาก 3D ครั้งแรก)
 * - visible: อยู่ในจอตอนนี้ (ใช้หยุด render เมื่อเลื่อนพ้น เพื่อประหยัดแบต)
 */
export function useInView(ref: RefObject<Element | null>, rootMargin = '200px') {
  const [state, setState] = useState({ mounted: false, visible: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setState((s) => ({ mounted: s.mounted || e.isIntersecting, visible: e.isIntersecting })),
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return state;
}
