import { motion } from 'framer-motion';
import { ArrowDown, Sparkles } from 'lucide-react';
import { lazy } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import { StaticCoin } from '../three/StaticCoin';
import { SceneFrame } from './SceneFrame';
import { scrollToId } from './scroll';

const HeroScene = lazy(() => import('./HeroScene'));

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export function Hero() {
  const session = useAuth((s) => s.session);
  return (
    <section id="top" className="relative mx-auto grid min-h-[100svh] max-w-6xl items-center gap-6 px-4 pb-16 pt-24 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
      <div aria-hidden className="pointer-events-none absolute right-0 top-1/3 -z-10 h-[28rem] w-[28rem] rounded-full bg-accent/25 blur-3xl" />
      <div className="text-center lg:text-left">
        <motion.p {...fade(0)} className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent-soft">
          <Sparkles size={13} aria-hidden /> บันทึกรายรับรายจ่าย ซิงก์ทุกอุปกรณ์
        </motion.p>
        <motion.h1 {...fade(0.08)} className="text-4xl font-bold leading-[1.2] tracking-tight sm:text-5xl lg:text-[3.35rem]">
          จัดการเงินของคุณ
          <br />
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-indigo-400 bg-clip-text text-transparent sm:whitespace-nowrap">ให้ง่ายเหมือนหยอดกระปุก</span>
        </motion.h1>
        <motion.p {...fade(0.16)} className="mx-auto mt-5 max-w-lg text-base text-muted sm:text-lg lg:mx-0">
          พิมพ์ "กาแฟ 65" แล้วกด Enter ระบบจัดหมวดให้เอง ดูยอดคงเหลือ งบประมาณ และเป้าหมายการออมได้ในที่เดียว
        </motion.p>
        <motion.div {...fade(0.24)} className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
          <Link to={session ? '/app' : '/register'} className="btn-primary px-6 py-3 text-base shadow-[0_0_32px_-4px] shadow-accent/70">
            {session ? 'ไปที่แดชบอร์ด' : 'เริ่มใช้งานฟรี'}
          </Link>
          <a href="#how" onClick={(e) => (e.preventDefault(), scrollToId('how'))} className="btn-outline px-6 py-3 text-base">
            ดูวิธีใช้งาน <ArrowDown size={16} aria-hidden />
          </a>
        </motion.div>
        <motion.ul {...fade(0.32)} className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-subtle lg:justify-start">
          <li>✓ สมัครด้วยอีเมลหรือ Google</li>
          <li>✓ ข้อมูลแยกตามบัญชี</li>
          <li>✓ ใช้ได้ทั้งมือถือและคอม</li>
        </motion.ul>
      </div>
      <SceneFrame
        className="relative mx-auto aspect-square w-full max-w-[34rem] lg:-mr-10"
        fallback={<StaticCoin className="h-full w-full p-16" />}
        render={(paused) => <HeroScene paused={paused} />}
      />
    </section>
  );
}
