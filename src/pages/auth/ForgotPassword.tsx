import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck, Send } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import type { z } from 'zod';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { Field } from '../../components/auth/Field';
import { errorMessage } from '../../lib/errors';
import { redirectTo, supabase } from '../../lib/supabase';
import { forgotSchema } from '../../lib/validation';

type Form = z.infer<typeof forgotSchema>;

export default function ForgotPassword() {
  const [sent, setSent] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async ({ email }: Form) => {
    setFormError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo('/reset-password') });
    // แสดงผลเหมือนกันไม่ว่าอีเมลจะมีในระบบหรือไม่ (กันการเดาอีเมล) ยกเว้น error เครือข่าย/rate limit
    if (error && error.status !== 400 && error.status !== 404) return setFormError(errorMessage(error));
    setSent(email);
  };

  return (
    <AuthLayout
      title={sent ? 'ตรวจสอบอีเมลของคุณ' : 'ลืมรหัสผ่าน'}
      subtitle={sent ? undefined : 'กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้'}
      footer={
        <Link to="/login" className="font-medium text-accent-soft hover:underline">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-income/15 text-income" aria-hidden>
            <MailCheck size={26} />
          </span>
          <p className="text-sm text-muted">
            หาก <strong className="text-fg">{sent}</strong> มีบัญชีอยู่ในระบบ คุณจะได้รับอีเมลพร้อมลิงก์ตั้งรหัสผ่านใหม่ภายในไม่กี่นาที
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="อีเมล" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
          {formError && (
            <p role="alert" className="rounded-xl border border-expense/30 bg-expense/10 px-3.5 py-2.5 text-sm text-expense">
              {formError}
            </p>
          )}
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 text-base">
            <Send size={16} /> {isSubmitting ? 'กำลังส่ง…' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
