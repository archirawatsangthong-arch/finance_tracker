import { useEffect } from 'react';
import * as api from '../lib/api';
import { todayISO } from '../lib/date';
import { invalidateMoney, qk, queryClient } from '../lib/queryClient';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/auth';
import { setRemoteSettingsSync, useSettings } from '../store/settings';
import { toast } from '../store/ui';
import { useProfile } from './useData';

// ตารางที่เปลี่ยน → cache ที่ต้องโหลดใหม่
const INVALIDATE: Record<string, () => unknown> = {
  transactions: invalidateMoney,
  categories: () => Promise.all([queryClient.invalidateQueries({ queryKey: qk.categories }), invalidateMoney()]),
  budgets: () => queryClient.invalidateQueries({ queryKey: ['budgets'] }),
  goals: () => queryClient.invalidateQueries({ queryKey: qk.goals }),
  recurring_rules: () => queryClient.invalidateQueries({ queryKey: qk.recurring }),
  profiles: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
};

/**
 * งานเบื้องหลังหลังล็อกอิน:
 * - ซิงก์ข้ามอุปกรณ์ด้วย Supabase Realtime (private channel ของผู้ใช้)
 * - สร้างรายการซ้ำที่ถึงกำหนด, บันทึกเวลาใช้งานล่าสุด
 * - ซิงก์ ธีม/สกุลเงิน/ศักราช ระหว่าง profile กับเครื่อง
 */
export function useSync(): void {
  const uid = useAuth((s) => s.user?.id);
  const { data: profile } = useProfile();

  // ---- Realtime ----
  useEffect(() => {
    if (!uid) return;
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      pending.forEach((t) => void INVALIDATE[t]?.());
      pending.clear();
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`user:${uid}`, { config: { private: true } })
        .on('broadcast', { event: 'change' }, ({ payload }) => {
          const table = (payload as { table?: string })?.table;
          if (!table) return;
          pending.add(table);
          // รวมหลาย event ที่มาติด ๆ กันเป็นการโหลดใหม่ครั้งเดียว
          clearTimeout(timer);
          timer = setTimeout(flush, 400);
        })
        .subscribe((status) => {
          // ต่อใหม่สำเร็จหลังหลุด → ดึงข้อมูลล่าสุดที่อาจพลาดไป
          if (status === 'SUBSCRIBED') void queryClient.invalidateQueries({ type: 'active' });
        });
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [uid]);

  // ---- รายการซ้ำ + last seen ----
  useEffect(() => {
    if (!uid) return;
    const run = async () => {
      try {
        const n = await api.processRecurring(todayISO());
        if (n > 0) {
          toast(`สร้างรายการซ้ำอัตโนมัติ ${n} รายการ`, { kind: 'info' });
          void invalidateMoney();
          void queryClient.invalidateQueries({ queryKey: qk.recurring });
        }
      } catch {
        // ไม่สำเร็จ (เช่น ออฟไลน์) จะลองใหม่เมื่อกลับมาที่แอป
      }
      void api.touchLastSeen().catch(() => undefined);
    };
    void run();
    const onVis = () => !document.hidden && void run();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', run);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', run);
    };
  }, [uid]);

  // ---- profile → การตั้งค่าในเครื่อง ----
  useEffect(() => {
    if (!profile) return;
    useSettings.getState().applyRemote({
      theme: profile.theme,
      currency: profile.currency,
      era: profile.useBuddhistYear ? 'BE' : 'CE',
    });
  }, [profile]);

  // ---- การตั้งค่าในเครื่อง → profile ----
  useEffect(() => {
    if (!uid) return;
    setRemoteSettingsSync((patch) => {
      void api
        .updateProfile(uid, {
          ...(patch.theme ? { theme: patch.theme } : {}),
          ...(patch.currency ? { currency: patch.currency } : {}),
          ...(patch.era ? { useBuddhistYear: patch.era === 'BE' } : {}),
        })
        .then(() => queryClient.invalidateQueries({ queryKey: qk.profile(uid) }))
        .catch(() => toast('บันทึกการตั้งค่าไปยังบัญชีไม่สำเร็จ (ใช้ได้เฉพาะเครื่องนี้)', { kind: 'warning' }));
    });
    return () => setRemoteSettingsSync(null);
  }, [uid]);

  // ---- บัญชีถูกระงับระหว่างใช้งาน → ออกจากระบบ ----
  useEffect(() => {
    if (profile?.isSuspended) {
      toast('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ', { kind: 'error', duration: 8000 });
      void useAuth.getState().signOut();
    }
  }, [profile?.isSuspended]);
}
