import { Loader2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useProfile } from '../../hooks/useData';
import { useAuth } from '../../store/auth';
import { useSettings } from '../../store/settings';
import { PinLock } from '../layout/PinLock';

export function FullScreenLoader({ label = 'กำลังโหลด' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center text-accent-soft" aria-live="polite">
      <Loader2 className="animate-spin" size={30} aria-label={label} />
    </div>
  );
}

/** ต้องล็อกอินก่อน — ถ้ายังไม่ล็อกอิน redirect ไป /login?next=<หน้าเดิม> */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { ready, session, recovery, signedOut } = useAuth();
  const location = useLocation();
  const pinHash = useSettings((s) => s.pinHash);
  const [unlocked, setUnlocked] = useState(false);

  if (!ready) return <FullScreenLoader />;
  if (!session) {
    // เพิ่งกดออกจากระบบ → กลับหน้า Landing, ยังไม่ล็อกอิน → ไป /login แล้วกลับมาหน้าเดิม
    if (signedOut) return <Navigate to="/" replace />;
    const next = location.pathname + location.search;
    return <Navigate to={next === '/app' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />;
  }
  // กดลิงก์รีเซ็ตรหัสผ่าน → ต้องตั้งรหัสใหม่ก่อน
  if (recovery) return <Navigate to="/reset-password" replace />;
  // PIN ล็อกหน้าจอของเครื่องนี้ (ไม่บังคับ)
  if (pinHash && !unlocked) return <PinLock onUnlock={() => setUnlocked(true)} />;
  return children ?? <Outlet />;
}

/** หน้าสำหรับคนที่ยังไม่ล็อกอิน (login/register) — ล็อกอินแล้วให้ไปแดชบอร์ด /app */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { ready, session, recovery } = useAuth();
  if (!ready) return <FullScreenLoader />;
  if (session && !recovery) return <Navigate to="/app" replace />;
  return children;
}

/**
 * เฉพาะผู้ดูแลระบบ (ตรวจ role จาก profile)
 * หมายเหตุ: นี่เป็นแค่การซ่อน UI — สิทธิ์จริงถูกบังคับในฐานข้อมูล (private.is_admin) และ Edge Function
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { data: profile, isPending } = useProfile();
  if (isPending) return <FullScreenLoader />;
  if (profile?.role !== 'admin' || profile.isSuspended) return <Navigate to="/app" replace />;
  return children;
}
