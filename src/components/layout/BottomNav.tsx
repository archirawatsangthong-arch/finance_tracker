import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { NAV } from './nav';

/** Bottom navigation สำหรับมือถือ/แท็บเล็ต */
export function BottomNav() {
  return (
    <nav
      aria-label="เมนูหลัก"
      className="glass-strong fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 rounded-2xl px-1 py-1.5 lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink to={to} end={to === '/app'} className="relative flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-medium text-subtle aria-[current=page]:text-fg">
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="bottom-active" className="absolute inset-0 rounded-xl bg-accent/15" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                  <Icon size={20} className={`relative ${isActive ? 'text-accent-soft' : ''}`} aria-hidden />
                  <span className="relative line-clamp-1">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
