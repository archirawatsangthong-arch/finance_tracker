import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import type { z } from 'zod';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { Field, PasswordStrength } from '../../components/auth/Field';
import { errorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { resetSchema } from '../../lib/validation';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/ui';

type Form = z.infer<typeof resetSchema>;

/** ตั้งรหัสผ่านใหม่หลังกดลิงก์จากอีเมล (ลิงก์ทำให้ล็อกอินแบบ recovery แล้ว) */
export default function ResetPassword() {
  const navigate = useNavigate();
  const session = useAuth((s) => s.session);
  const ready = useAuth((s) => s.ready);
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirm: '' },
  });
  const pw = useWatch({ control, name: 'password' }) ?? '';

  const onSubmit = async ({ password }: Form) => {
    setFormError('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setFormError(errorMessage(error, 'ตั้งรหัสผ่านไม่สำเร็จ'));
    useAuth.getState().clearRecovery();
    toast('ตั้งรหัสผ่านใหม่เรียบร้อย');
    navigate('/app', { replace: true });
  };

  if (ready && !session) {
    return (
      <AuthLayout title="ลิงก์หมดอายุ" subtitle="ลิงก์รีเซ็ตรหัสผ่านใช้ไม่ได้แล้ว กรุณาขอลิงก์ใหม่">
        <Link to="/forgot-password" className="btn-primary w-full py-3">
          ขอลิงก์ใหม่
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="ตั้งรหัสผ่านใหม่" subtitle={session?.user.email}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <Field label="รหัสผ่านใหม่" type="password" autoComplete="new-password" maxLength={72} error={errors.password?.message} hint="อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข" {...register('password')} />
          <PasswordStrength value={pw} />
        </div>
        <Field label="ยืนยันรหัสผ่านใหม่" type="password" autoComplete="new-password" maxLength={72} error={errors.confirm?.message} {...register('confirm')} />
        {formError && (
          <p role="alert" className="rounded-xl border border-expense/30 bg-expense/10 px-3.5 py-2.5 text-sm text-expense">
            {formError}
          </p>
        )}
        <button type="submit" disabled={isSubmitting || !session} className="btn-primary w-full py-3 text-base">
          <KeyRound size={16} /> {isSubmitting ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}
        </button>
      </form>
    </AuthLayout>
  );
}
