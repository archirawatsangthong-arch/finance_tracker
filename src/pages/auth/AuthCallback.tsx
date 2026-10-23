import type { EmailOtpType } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { errorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/auth';
import { safeNext } from './safeNext';

const OTP_TYPES: EmailOtpType[] = ['email', 'signup', 'recovery', 'invite', 'magiclink', 'email_change'];

/**
 * ปลายทางของลิงก์จากอีเมลและ OAuth
 * - /auth/confirm?token_hash=...&type=...  → ยืนยันด้วย verifyOtp (ใช้ได้แม้เปิดลิงก์คนละเครื่อง)
 * - /auth/callback?code=...                → Supabase แลก code เป็น session ให้อัตโนมัติ (OAuth / PKCE)
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const session = useAuth((s) => s.session);
  const ready = useAuth((s) => s.ready);
  const [error, setError] = useState<string | null>(() => {
    const desc = params.get('error_description') ?? new URLSearchParams(window.location.hash.slice(1)).get('error_description');
    return desc ? (/expired|invalid/i.test(desc) ? 'ลิงก์หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่' : 'ยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่') : null;
  });
  const started = useRef(false);
  const type = params.get('type') as EmailOtpType | null;
  const next = type === 'recovery' ? '/reset-password' : safeNext(params.get('next'));

  // ลิงก์แบบ token_hash
  useEffect(() => {
    const tokenHash = params.get('token_hash');
    if (!tokenHash || !type || started.current || error) return;
    started.current = true;
    if (!OTP_TYPES.includes(type)) return setError('ลิงก์ไม่ถูกต้อง');
    void supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error: e }) => {
      if (e) setError(errorMessage(e, 'ลิงก์หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่'));
      else {
        if (type === 'recovery') useAuth.setState({ recovery: true });
        navigate(next, { replace: true });
      }
    });
  }, [params, type, next, navigate, error]);

  // ลิงก์แบบ code (OAuth): รอให้ session พร้อม
  useEffect(() => {
    if (params.get('token_hash') || error) return;
    if (session) {
      navigate(next, { replace: true });
      return;
    }
    if (!ready) return;
    const t = setTimeout(() => setError('ยืนยันตัวตนไม่สำเร็จ ลิงก์อาจหมดอายุ หรือเปิดคนละเบราว์เซอร์กับที่ขอไว้'), 8000);
    return () => clearTimeout(t);
  }, [session, ready, params, next, navigate, error]);

  return (
    <AuthLayout title={error ? 'เกิดข้อผิดพลาด' : 'กำลังยืนยันตัวตน…'}>
      {error ? (
        <div className="space-y-4 text-center">
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
          <div className="flex justify-center gap-2">
            <Link to="/login" className="btn-primary">
              ไปหน้าเข้าสู่ระบบ
            </Link>
            {type === 'recovery' && (
              <Link to="/forgot-password" className="btn-outline">
                ขอลิงก์ใหม่
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="flex justify-center py-4 text-accent-soft" aria-live="polite">
          <Loader2 className="animate-spin" size={28} aria-label="กำลังโหลด" />
        </div>
      )}
    </AuthLayout>
  );
}
