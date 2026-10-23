import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Hero3D } from '../three/Hero3D';
import { ParticleBackground } from '../three/ParticleBackground';
import { Toaster } from '../ui/Toaster';

interface Props {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/** โครงหน้า Login/Register: การ์ด glass ตรงกลาง + เหรียญ 3D ลอยหมุน + particles */
export function AuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <ParticleBackground />
      <div aria-hidden className="pointer-events-none fixed left-1/2 top-1/2 -z-10 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-3xl" />
      <motion.main
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="glass glow-border relative w-full max-w-md rounded-3xl px-6 pb-7 pt-4 sm:px-8"
      >
        <Hero3D className="mx-auto -mb-2 h-36 w-full max-w-[16rem]" />
        <div className="mb-6 text-center">
          <p className="mb-1 flex items-center justify-center gap-2 text-sm font-semibold tracking-tight text-accent-soft">
            <img src="/favicon.svg" alt="" className="h-5 w-5" /> Coinly
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {children}
        {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
      </motion.main>
      <Toaster />
    </div>
  );
}
