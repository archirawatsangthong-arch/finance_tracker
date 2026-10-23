import { motion } from 'framer-motion';
import { ArrowLeft, LayoutDashboard, Shield, Users } from 'lucide-react';
import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { PageSkeleton } from '../../components/layout/AppLayout';
import { UserMenu } from '../../components/layout/UserMenu';
import { ParticleBackground } from '../../components/three/ParticleBackground';
import { Toaster } from '../../components/ui/Toaster';

const NAV = [
  { to: '/admin', label: 'ภาพรวมระบบ', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'จัดการผู้ใช้', icon: Users, end: false },
];

/** โครงหลังบ้าน: ดีไซน์เดียวกับแอป แต่ accent เป็นฟ้าไซแอน (class .admin-theme) */
export default function AdminLayout() {
  return (
    <div className="admin-theme min-h-dvh">
      <ParticleBackground />
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-cyan-500/10 to-transparent" />
      <aside className="glass fixed inset-y-4 left-4 z-30 hidden w-60 flex-col rounded-3xl p-4 lg:flex" aria-label="เมนูหลังบ้าน">
        <div className="mb-8 flex items-center gap-2.5 px-2 pt-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/20 text-accent-soft" aria-hidden>
            <Shield size={18} />
          </span>
          <div>
            <p className="text-base font-semibold tracking-tight">Coinly Admin</p>
            <p className="text-[11px] text-subtle">ระบบหลังบ้าน</p>
          </div>
        </div>
        <nav className="flex-1">
          <ul className="space-y-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:text-fg aria-[current=page]:text-fg">
                  {({ isActive }) => (
                    <>
                      {isActive && <motion.span layoutId="admin-active" className="absolute inset-0 rounded-xl bg-accent/15 ring-1 ring-accent/30" />}
                      <Icon size={18} className={`relative ${isActive ? 'text-accent-soft' : ''}`} aria-hidden />
                      <span className="relative">{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <NavLink to="/app" className="btn-ghost mb-3 justify-start">
          <ArrowLeft size={16} /> กลับไปแอปหลัก
        </NavLink>
        <div className="border-t border-line pt-3">
          <UserMenu />
        </div>
      </aside>

      {/* มือถือ: แถบเมนูด้านบน */}
      <header className="glass-strong sticky top-0 z-30 flex items-center gap-2 px-3 py-2 lg:hidden">
        <NavLink to="/app" className="btn-ghost p-2" aria-label="กลับไปแอปหลัก">
          <ArrowLeft size={18} />
        </NavLink>
        <nav className="flex flex-1 gap-1" aria-label="เมนูหลังบ้าน">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-muted aria-[current=page]:bg-accent/15 aria-[current=page]:text-fg">
              <Icon size={15} aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
        <UserMenu compact />
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:pl-72 lg:pr-8 lg:pt-8">
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-medium text-accent-soft">
          <Shield size={12} aria-hidden /> โหมดผู้ดูแลระบบ · เห็นเฉพาะสถิติรวม ไม่เห็นรายการเงินของผู้ใช้
        </div>
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <Toaster />
    </div>
  );
}
