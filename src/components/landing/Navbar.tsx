import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, LogIn, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import { scrollToId, SECTIONS } from './scroll';

/** แถบเมนูด้านบน (sticky) — โปร่งใสตอนอยู่บนสุด และเป็น glass เบลอเมื่อเลื่อนลง */
export function Navbar() {
  const session = useAuth((s) => s.session);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const go = (id: string) => {
    setOpen(false);
    scrollToId(id);
  };

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled || open ? 'glass-strong !rounded-none !border-x-0 !border-t-0' : 'border-b border-transparent'}`}>
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6" aria-label="เมนูหลัก">
        <a href="#top" onClick={(e) => (e.preventDefault(), window.scrollTo({ top: 0, behavior: 'smooth' }))} className="flex items-center gap-2 rounded-lg font-semibold tracking-tight">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <span className="text-lg">Coinly</span>
        </a>

        <ul className="mx-auto hidden items-center gap-1 md:flex">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} onClick={(e) => (e.preventDefault(), go(s.id))} className="rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-fg/5 hover:text-fg">
                {s.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {session ? (
            <Link to="/app" className="btn-primary px-3.5 py-2 shadow-[0_0_24px_-4px] shadow-accent/70 sm:px-4">
              <LayoutDashboard size={16} aria-hidden /> ไปที่แดชบอร์ด
            </Link>
          ) : (
            <>
              {/* ปุ่มเข้าสู่ระบบแสดงตลอดแม้บนมือถือ */}
              <Link to="/login" className="btn-ghost px-3 py-2 text-fg">
                <LogIn size={16} aria-hidden className="sm:hidden" />
                เข้าสู่ระบบ
              </Link>
              <Link to="/register" className="btn-primary hidden px-4 py-2 shadow-[0_0_24px_-4px] shadow-accent/70 sm:inline-flex">
                เริ่มใช้งานฟรี
              </Link>
            </>
          )}
          <button type="button" onClick={() => setOpen((v) => !v)} className="btn-ghost p-2 md:hidden" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? 'ปิดเมนู' : 'เปิดเมนู'}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line md:hidden"
          >
            <ul className="space-y-1 px-4 py-3">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} onClick={(e) => (e.preventDefault(), go(s.id))} className="block rounded-xl px-3 py-3 text-sm text-fg hover:bg-fg/5">
                    {s.label}
                  </a>
                </li>
              ))}
              {!session && (
                <li className="pt-2">
                  <Link to="/register" className="btn-primary w-full py-3">
                    เริ่มใช้งานฟรี
                  </Link>
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
