import { AnimatePresence, motion } from 'framer-motion';
import { ChevronUp, LogOut, Shield, UserRound } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../../hooks/useData';
import { useAuth } from '../../store/auth';

export function Avatar({ url, name, size = 36 }: { url?: string | null; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  if (url && !broken) {
    return <img src={url} alt="" width={size} height={size} onError={() => setBroken(true)} className="shrink-0 rounded-full object-cover ring-1 ring-line" style={{ width: size, height: size }} referrerPolicy="no-referrer" />;
  }
  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {initial}
    </span>
  );
}

/** มุมซ้ายล่างของ sidebar: รูป + ชื่อ + เมนู (โปรไฟล์ / หลังบ้าน / ออกจากระบบ) */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { data: profile } = useProfile();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const name = profile?.displayName || user?.email?.split('@')[0] || 'ผู้ใช้';

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <AnimatePresence>
        {open && (
          <motion.ul
            id={menuId}
            role="menu"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={`glass-strong absolute z-50 rounded-2xl p-1.5 ${compact ? 'right-0 top-full mt-2 w-52' : 'bottom-full left-0 right-0 mb-2'}`}
          >
            <li role="none">
              <Link role="menuitem" to="/app/account" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm hover:bg-fg/5">
                <UserRound size={16} className="text-muted" aria-hidden /> โปรไฟล์ & บัญชี
              </Link>
            </li>
            {profile?.role === 'admin' && (
              <li role="none">
                <Link role="menuitem" to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm hover:bg-fg/5">
                  <Shield size={16} className="text-cyan-400" aria-hidden /> หลังบ้าน (Admin)
                </Link>
              </li>
            )}
            <li role="none">
              <button role="menuitem" type="button" onClick={() => void signOut()} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-expense hover:bg-expense/10">
                <LogOut size={16} aria-hidden /> ออกจากระบบ
              </button>
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`เมนูบัญชีของ ${name}`}
        className={`flex w-full items-center gap-2.5 rounded-xl text-left transition hover:bg-fg/5 ${compact ? 'p-1' : 'p-2'}`}
      >
        <Avatar url={profile?.avatarUrl} name={name} size={compact ? 34 : 36} />
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{name}</span>
              <span className="block truncate text-[11px] text-subtle">{user?.email}</span>
            </span>
            <ChevronUp size={15} className={`text-subtle transition ${open ? '' : 'rotate-180'}`} aria-hidden />
          </>
        )}
      </button>
    </div>
  );
}
