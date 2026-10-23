import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** ตั้งค่า .env ครบหรือยัง — ถ้ายัง แอปจะแสดงหน้าคำแนะนำแทน */
export const supabaseConfigured = Boolean(url && key);

// กันพลาดใส่ secret key ใน frontend (จะถูก bundle และเปิดเผยต่อทุกคน)
if (key && (key.startsWith('sb_secret_') || /service_role/.test(atob(key.split('.')[1] ?? '').replace(/[^\x20-\x7e]/g, '')))) {
  throw new Error('VITE_SUPABASE_ANON_KEY ต้องเป็น publishable/anon key เท่านั้น ห้ามใช้ secret หรือ service_role key');
}

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'coinly-auth',
  },
});

/** URL ที่ใช้ส่งกลับหลังยืนยันอีเมล / OAuth / รีเซ็ตรหัสผ่าน */
export const redirectTo = (path: string): string => `${window.location.origin}${path}`;
