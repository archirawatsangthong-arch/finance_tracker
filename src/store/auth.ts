import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { queryClient } from '../lib/queryClient';
import { supabase, supabaseConfigured } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  /** โหลด session จาก storage เสร็จแล้ว */
  ready: boolean;
  /** ผู้ใช้กดลิงก์รีเซ็ตรหัสผ่านจากอีเมล → ต้องไปหน้าตั้งรหัสใหม่ */
  recovery: boolean;
  /** เพิ่งกดออกจากระบบ → หน้าที่ต้องล็อกอินจะส่งกลับไปหน้า Landing "/" แทน /login */
  signedOut: boolean;
  clearRecovery: () => void;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>()((set) => ({
  session: null,
  user: null,
  ready: !supabaseConfigured,
  recovery: false,
  signedOut: false,
  clearRecovery: () => set({ recovery: false }),
  signOut: async () => {
    // scope 'local' = ออกจากระบบเฉพาะเครื่องนี้ (ไม่เตะอุปกรณ์อื่น)
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    queryClient.clear();
    set({ session: null, user: null, signedOut: true });
  },
}));

let started = false;

/** เริ่มฟังสถานะการล็อกอิน (เรียกครั้งเดียวตอนเปิดแอป) */
export function initAuth(): void {
  if (started || !supabaseConfigured) return;
  started = true;
  void supabase.auth.getSession().then(({ data }) => {
    useAuth.setState({ session: data.session, user: data.session?.user ?? null, ready: true });
  });
  supabase.auth.onAuthStateChange((event, session) => {
    const prev = useAuth.getState().user?.id;
    // เปลี่ยนผู้ใช้ → ล้าง cache ของคนก่อนหน้าทั้งหมด
    if (prev && prev !== session?.user.id) queryClient.clear();
    useAuth.setState({
      session,
      user: session?.user ?? null,
      ready: true,
      ...(event === 'PASSWORD_RECOVERY' ? { recovery: true } : {}),
      ...(session ? { signedOut: false } : {}),
    });
  });
}
