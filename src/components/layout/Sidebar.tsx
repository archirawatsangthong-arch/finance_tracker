import { motion } from 'framer-motion';
import { Eye, EyeOff, Moon, Sun } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useSettings } from '../../store/settings';
import { NAV } from './nav';
import { UserMenu } from './UserMenu';

/** Sidebar แบบกระจกสำหรับเดสก์ท็อป */
export function Sidebar() {
  const { theme, toggleTheme, privacy, togglePrivacy } = useSettings();
  return (
    <aside className="glass fixed inset-y-4 left-4 z-30 hidden w-60 flex-col rounded-3xl p-4 lg:flex" aria-label="เมนูหลัก">
      <div className="mb-8 flex items-center gap-2.5 px-2 pt-2">
        <img src="/favicon.svg" alt="" className="h-9 w-9" />
        <div>
          <p className="text-base font-semibold tracking-tight">Coinly</p>
          <p className="text-[11px] text-subtle">บันทึกรายรับรายจ่าย</p>
        </div>
      </div>
      <nav className="flex-1">
        <ul className="space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink to={to} end={to === '/app'} className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:text-fg aria-[current=page]:text-fg">
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span layoutId="sidebar-active" className="absolute inset-0 rounded-xl bg-accent/15 ring-1 ring-accent/30" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                    )}
                    <Icon size={18} className={`relative ${isActive ? 'text-accent-soft' : ''}`} aria-hidden />
                    <span className="relative">{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex gap-2 pb-3">
        <button type="button" onClick={togglePrivacy} className="btn-ghost flex-1 px-2" aria-pressed={privacy} aria-label={privacy ? 'แสดงตัวเลข' : 'ซ่อนตัวเลข'}>
          {privacy ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
        <button type="button" onClick={toggleTheme} className="btn-ghost flex-1 px-2" aria-label={theme === 'dark' ? 'สลับเป็นโหมดสว่าง (D)' : 'สลับเป็นโหมดมืด (D)'}>
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
      <div className="border-t border-line pt-3">
        <UserMenu />
      </div>
      <p className="mt-2 px-2 text-[11px] leading-relaxed text-subtle">
        คีย์ลัด: <kbd className="font-mono">N</kbd> เพิ่ม · <kbd className="font-mono">/</kbd> ค้นหา · <kbd className="font-mono">D</kbd> ธีม
      </p>
    </aside>
  );
}
