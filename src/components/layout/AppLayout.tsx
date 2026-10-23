import { AnimatePresence, motion } from 'framer-motion';
import { Suspense } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { useHotkeys } from '../../hooks/useHotkeys';
import { useSync } from '../../hooks/useSync';
import { useReducedMotion } from '../../hooks/useEnv';
import { Celebration } from '../three/Celebration';
import { ParticleBackground } from '../three/ParticleBackground';
import { TransactionEditor } from '../transactions/TransactionEditor';
import { Skeleton } from '../ui/Card';
import { Toaster } from '../ui/Toaster';
import { BottomNav } from './BottomNav';
import { QuickAddButton } from './QuickAddButton';
import { Sidebar } from './Sidebar';
import { UserMenu } from './UserMenu';

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลด">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-40 w-full" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function AppLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduced = useReducedMotion();
  useHotkeys(true);
  useSync();

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white">
        ข้ามไปเนื้อหาหลัก
      </a>
      <ParticleBackground />
      <Sidebar />
      {/* มือถือ/แท็บเล็ต: เมนูบัญชีมุมขวาบน (เดสก์ท็อปอยู่ใน sidebar) */}
      <div className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-30 lg:hidden">
        <div className="glass rounded-full">
          <UserMenu compact />
        </div>
      </div>
      <main id="main" className="mx-auto max-w-6xl px-4 pb-40 pt-[max(4.25rem,calc(env(safe-area-inset-top)+3.5rem))] sm:px-6 lg:pb-12 lg:pl-72 lg:pr-8 lg:pt-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <Suspense fallback={<PageSkeleton />}>{outlet}</Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <QuickAddButton />
      <BottomNav />
      <TransactionEditor />
      <Celebration />
      <Toaster />
    </>
  );
}
