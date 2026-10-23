import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { lazy, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../../hooks/useEnv';
import { SceneFrame } from '../SceneFrame';
import { tutorialProgress } from './progress';
import { STEPS } from './steps';
import { TutorialFallback } from './TutorialFallback';

gsap.registerPlugin(ScrollTrigger);

const TutorialScene = lazy(() => import('./TutorialScene'));

/**
 * Tutorial แบบ scroll storytelling
 * - ฉาก 3D ปักหมุด (sticky) ฝั่งขวา (มือถือ: ด้านบน) ข้อความแต่ละขั้นเลื่อนผ่านอีกฝั่ง
 * - GSAP ScrollTrigger แปลงตำแหน่ง scroll เป็น progress ต่อเนื่อง 0..4 → ฉาก lerp ตามแบบนุ่ม ๆ
 */
export function TutorialSection() {
  const root = useRef<HTMLElement>(null);
  const stepRefs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      // progress ต่อเนื่อง: ขั้น i อยู่ตรงกลางจอ = i
      STEPS.forEach((_, i) => {
        const card = stepRefs.current[i];
        if (!card) return;
        ScrollTrigger.create({
          trigger: card,
          start: 'top center',
          end: 'bottom center',
          onUpdate: (st) => {
            tutorialProgress.target = i - 0.5 + st.progress;
          },
          onToggle: (st) => st.isActive && setActive(i),
        });
        // ข้อความค่อย ๆ ปรากฏ (ปิดเมื่อผู้ใช้ตั้งลดการเคลื่อนไหว)
        if (!reduced) {
          gsap.fromTo(card, { opacity: 0.25, y: 40 }, { opacity: 1, y: 0, ease: 'power2.out', scrollTrigger: { trigger: card, start: 'top 85%', end: 'top 45%', scrub: true } });
        }
      });
      // ก่อนถึงขั้นแรก/หลังขั้นสุดท้าย ให้ค้างที่ขั้นปลาย
      ScrollTrigger.create({
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        onLeaveBack: () => (tutorialProgress.target = 0),
        onLeave: () => (tutorialProgress.target = STEPS.length - 1),
      });
    }, el);
    // ฟอนต์/ฉาก 3D โหลดเสร็จแล้วความสูงเปลี่ยน → คำนวณตำแหน่งใหม่
    const t = setTimeout(() => ScrollTrigger.refresh(), 800);
    return () => {
      clearTimeout(t);
      ctx.revert();
    };
  }, [reduced]);

  const goTo = (i: number) => stepRefs.current[i]?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });

  return (
    <section ref={root} id="how" aria-labelledby="how-title" className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <header className="mx-auto mb-10 max-w-2xl text-center lg:mb-4">
        <p className="text-sm font-semibold text-accent-soft">วิธีใช้งาน</p>
        <h2 id="how-title" className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          เริ่มต้นได้ใน 5 ขั้นตอน
        </h2>
        <p className="mt-3 text-muted">เลื่อนลงเพื่อดูว่า Coinly ช่วยจัดการเงินของคุณอย่างไร</p>
      </header>

      <div className="relative grid gap-6 lg:grid-cols-2 lg:gap-12">
        {/* ฉาก 3D ปักหมุด — มือถืออยู่ด้านบน เดสก์ท็อปอยู่ขวา */}
        <div className="sticky top-16 z-10 h-[38svh] lg:order-2 lg:top-0 lg:flex lg:h-svh lg:items-center">
          <div className="relative h-full w-full lg:h-[34rem]">
            <div aria-hidden className="absolute inset-[12%] rounded-full bg-accent/20 blur-3xl" />
            <SceneFrame className="relative h-full w-full" fallback={<TutorialFallback step={active} />} render={(paused) => <TutorialScene paused={paused} />} />
            <StepIndicator active={active} onSelect={goTo} />
          </div>
        </div>

        <ol className="relative lg:order-1">
          {STEPS.map((s, i) => (
            <li key={s.id} data-step={i} ref={(el) => void (stepRefs.current[i] = el)} className="flex min-h-svh items-end pb-[5svh] pt-8 lg:items-center lg:py-8" aria-current={active === i ? 'step' : undefined}>
              <article className={`glass w-full rounded-3xl p-6 transition-shadow duration-500 sm:p-8 ${active === i ? 'shadow-[0_0_60px_-20px] shadow-accent' : ''}`}>
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent-soft ring-1 ring-accent/30">
                    <s.icon size={22} aria-hidden />
                  </span>
                  <span className="num text-sm font-semibold text-subtle">
                    ขั้นที่ {i + 1}/{STEPS.length}
                  </span>
                </div>
                <h3 className="text-2xl font-bold tracking-tight">{s.title}</h3>
                <p className="mt-3 leading-relaxed text-muted">{s.body}</p>
                <ul className="mt-5 space-y-2.5">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex gap-2.5 text-sm">
                      <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px] shadow-accent" />
                      {b}
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** ตัวบอกขั้นตอน (1/5 … 5/5) — กดเพื่อกระโดดไปขั้นนั้นได้ */
function StepIndicator({ active, onSelect }: { active: number; onSelect: (i: number) => void }) {
  return (
    <nav aria-label="ขั้นตอน tutorial" className="glass absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 lg:bottom-6">
      <span className="num text-xs font-semibold text-fg" aria-live="polite">
        {active + 1}/{STEPS.length}
      </span>
      <ol className="flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-label={`ขั้นที่ ${i + 1}: ${s.title}`}
              aria-current={active === i ? 'step' : undefined}
              className={`block h-2 rounded-full transition-all duration-300 ${active === i ? 'w-6 bg-accent shadow-[0_0_10px] shadow-accent' : 'w-2 bg-fg/25 hover:bg-fg/50'}`}
            />
          </li>
        ))}
      </ol>
    </nav>
  );
}
