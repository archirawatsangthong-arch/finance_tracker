import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { z } from 'zod';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { Divider, Field, PasswordStrength } from '../../components/auth/Field';
import { GoogleButton } from '../../components/auth/GoogleButton';
import { errorMessage } from '../../lib/errors';
import { redirectTo, supabase } from '../../lib/supabase';
import { registerSchema } from '../../lib/validation';
import { toast } from '../../store/ui';
import { safeNext } from './safeNext';

type Form = z.input<typeof registerSchema>;

export default function Register() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', password: '', confirm: '' },
  });
  const pw = useWatch({ control, name: 'password' }) ?? '';

  const onSubmit = async (values: Form) => {
    setFormError('');
    const { data, error } = await supabase.auth.signUp({
      email: values.email.trim(),
      password: values.password,
      options: {
        data: { display_name: values.displayName.trim() },
        emailRedirectTo: redirectTo(`/auth/callback?next=${encodeURIComponent(next)}`),
      },
    });
    if (error) return setFormError(errorMessage(error, 'สมัครสมาชิกไม่สำเร็จ'));
    // ถ้าปิดการยืนยันอีเมลไว้ Supabase จะคืน session มาเลย
    if (data.session) return navigate(next, { replace: true });
    // อีเมลซ้ำ: Supabase จะคืน user ที่ไม่มี identity (กันการเดาอีเมล) → แสดงข้อความเดียวกันเพื่อความเป็นส่วนตัว
    setSentTo(values.email.trim());
  };

  const resend = async () => {
    if (!sentTo) return;
    const { error } = await supabase.auth.resend({ type: 'signup', email: sentTo, options: { emailRedirectTo: redirectTo('/auth/callback') } });
    toast(error ? errorMessage(error) : 'ส่งอีเมลยืนยันอีกครั้งแล้ว', { kind: error ? 'error' : 'success' });
  };

  if (sentTo) {
    return (
      <AuthLayout title="ยืนยันอีเมลของคุณ" subtitle={<>เราส่งลิงก์ยืนยันไปที่ <strong className="text-fg">{sentTo}</strong> แล้ว</>}>
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-income/15 text-income" aria-hidden>
            <MailCheck size={26} />
          </span>
          <p className="text-sm text-muted">เปิดอีเมลแล้วกดลิงก์เพื่อเปิดใช้งานบัญชี หากไม่พบ ลองดูในโฟลเดอร์สแปม</p>
          <button type="button" onClick={resend} className="btn-outline w-full">
            ส่งอีเมลอีกครั้ง
          </button>
          <Link to="/login" className="text-sm font-medium text-accent-soft hover:underline">
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="สร้างบัญชีใหม่"
      subtitle="เริ่มต้นจดรายรับรายจ่ายได้ในไม่กี่วินาที"
      footer={
        <>
          มีบัญชีอยู่แล้ว?{' '}
          <Link to="/login" className="font-medium text-accent-soft hover:underline">
            เข้าสู่ระบบ
          </Link>
        </>
      }
    >
      <GoogleButton next={next} />
      <Divider>หรือสมัครด้วยอีเมล</Divider>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="ชื่อที่ใช้แสดง" autoComplete="nickname" maxLength={60} placeholder="เช่น มิ้นท์" error={errors.displayName?.message} {...register('displayName')} />
        <Field label="อีเมล" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
        <div>
          <Field label="รหัสผ่าน" type="password" autoComplete="new-password" maxLength={72} error={errors.password?.message} hint="อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข" {...register('password')} />
          <PasswordStrength value={pw} />
        </div>
        <Field label="ยืนยันรหัสผ่าน" type="password" autoComplete="new-password" maxLength={72} error={errors.confirm?.message} {...register('confirm')} />
        <div>
          <label className="flex items-start gap-2.5 text-sm text-muted">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-violet-500" aria-invalid={!!errors.accept} {...register('accept')} />
            <span>ฉันยอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว</span>
          </label>
          {errors.accept && (
            <p role="alert" className="mt-1.5 text-xs text-expense">
              {errors.accept.message}
            </p>
          )}
        </div>
        {formError && (
          <p role="alert" className="rounded-xl border border-expense/30 bg-expense/10 px-3.5 py-2.5 text-sm text-expense">
            {formError}
          </p>
        )}
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 text-base">
          <UserPlus size={17} /> {isSubmitting ? 'กำลังสร้างบัญชี…' : 'สมัครสมาชิก'}
        </button>
      </form>
    </AuthLayout>
  );
}
