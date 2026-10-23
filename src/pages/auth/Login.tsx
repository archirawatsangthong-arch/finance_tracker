import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { z } from 'zod';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { Divider, Field } from '../../components/auth/Field';
import { GoogleButton } from '../../components/auth/GoogleButton';
import { errorMessage } from '../../lib/errors';
import { redirectTo, supabase } from '../../lib/supabase';
import { loginSchema } from '../../lib/validation';
import { toast } from '../../store/ui';
import { safeNext } from './safeNext';

type Form = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: Form) => {
    setFormError('');
    setUnconfirmed(null);
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      if (error.code === 'email_not_confirmed') setUnconfirmed(values.email);
      setFormError(errorMessage(error, 'เข้าสู่ระบบไม่สำเร็จ'));
      return;
    }
    navigate(next, { replace: true });
  };

  const resend = async () => {
    if (!unconfirmed) return;
    const { error } = await supabase.auth.resend({ type: 'signup', email: unconfirmed, options: { emailRedirectTo: redirectTo('/auth/callback') } });
    toast(error ? errorMessage(error) : 'ส่งอีเมลยืนยันอีกครั้งแล้ว', { kind: error ? 'error' : 'success' });
  };

  return (
    <AuthLayout
      title="ยินดีต้อนรับกลับมา"
      subtitle="เข้าสู่ระบบเพื่อดูรายรับรายจ่ายของคุณ"
      footer={
        <>
          ยังไม่มีบัญชี?{' '}
          <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-accent-soft hover:underline">
            สมัครสมาชิก
          </Link>
        </>
      }
    >
      <GoogleButton next={next} />
      <Divider>หรือใช้อีเมล</Divider>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="อีเมล" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
        <div>
          <Field label="รหัสผ่าน" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
          <div className="mt-2 text-right">
            <Link to="/forgot-password" className="text-xs font-medium text-accent-soft hover:underline">
              ลืมรหัสผ่าน?
            </Link>
          </div>
        </div>
        {formError && (
          <div role="alert" className="rounded-xl border border-expense/30 bg-expense/10 px-3.5 py-2.5 text-sm text-expense">
            {formError}
            {unconfirmed && (
              <button type="button" onClick={resend} className="mt-1 block font-medium underline">
                ส่งอีเมลยืนยันอีกครั้ง
              </button>
            )}
          </div>
        )}
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 text-base">
          <LogIn size={17} /> {isSubmitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </AuthLayout>
  );
}
