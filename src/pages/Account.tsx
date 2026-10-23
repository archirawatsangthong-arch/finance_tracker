import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Download, KeyRound, LogOut, RotateCcw, Upload, UserX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import type { z } from 'zod';
import { Field, PasswordStrength } from '../components/auth/Field';
import { Avatar } from '../components/layout/UserMenu';
import { ConfirmDialog } from '../components/settings/ConfirmDialog';
import { Card, PageHeader, Skeleton } from '../components/ui/Card';
import { Sheet } from '../components/ui/Sheet';
import { useProfile } from '../hooks/useData';
import * as api from '../lib/api';
import { removeAvatarFiles, uploadAvatar } from '../lib/avatar';
import { exportCSV, exportJSON, importCSV, importJSON } from '../lib/backup';
import { errorMessage } from '../lib/errors';
import { formatDate } from '../lib/format';
import { qk } from '../lib/queryClient';
import { supabase } from '../lib/supabase';
import { profileSchema, resetSchema } from '../lib/validation';
import { useAuth } from '../store/auth';
import { useSettings } from '../store/settings';
import { toast } from '../store/ui';

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof resetSchema>;

function ProfileCard() {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user)!;
  const era = useSettings((s) => s.era);
  const { data: profile } = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) });

  useEffect(() => {
    if (profile) reset({ displayName: profile.displayName });
  }, [profile, reset]);

  const refresh = () => qc.invalidateQueries({ queryKey: qk.profile(user.id) });

  const save = async ({ displayName }: ProfileForm) => {
    try {
      await api.updateProfile(user.id, { displayName });
      await refresh();
      toast('บันทึกโปรไฟล์แล้ว');
    } catch (e) {
      toast(errorMessage(e), { kind: 'error' });
    }
  };

  const onFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadAvatar(user.id, file);
      await api.updateProfile(user.id, { avatarUrl: url });
      await refresh();
      toast('อัปเดตรูปโปรไฟล์แล้ว');
    } catch (e) {
      toast(errorMessage(e, 'อัปโหลดรูปไม่สำเร็จ'), { kind: 'error' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = async () => {
    try {
      await removeAvatarFiles(user.id);
      await api.updateProfile(user.id, { avatarUrl: null });
      await refresh();
      toast('ลบรูปโปรไฟล์แล้ว', { kind: 'info' });
    } catch (e) {
      toast(errorMessage(e), { kind: 'error' });
    }
  };

  if (!profile) return <Skeleton className="h-48" />;
  const provider = (user.app_metadata?.provider as string | undefined) ?? 'email';

  return (
    <Card title="โปรไฟล์">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <Avatar url={profile.avatarUrl} name={profile.displayName || user.email || '?'} size={88} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white shadow-lg ring-4 ring-bg disabled:opacity-60"
              aria-label="เปลี่ยนรูปโปรไฟล์"
            >
              <Camera size={16} className={uploading ? 'animate-pulse' : ''} />
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} aria-label="เลือกรูปโปรไฟล์" />
          </div>
          {profile.avatarUrl && (
            <button type="button" onClick={removePhoto} className="text-xs text-subtle hover:text-expense">
              ลบรูป
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit(save)} className="flex-1 space-y-4" noValidate>
          <Field label="ชื่อที่ใช้แสดง" maxLength={60} error={errors.displayName?.message} {...register('displayName')} />
          <div className="grid gap-1 text-sm">
            <p>
              <span className="text-muted">อีเมล:</span> {user.email}
            </p>
            <p>
              <span className="text-muted">เข้าสู่ระบบด้วย:</span> {provider === 'google' ? 'Google' : 'อีเมลและรหัสผ่าน'}
            </p>
            <p>
              <span className="text-muted">สมาชิกตั้งแต่:</span> {formatDate(profile.createdAt.slice(0, 10), era, 'long')}
            </p>
          </div>
          <button type="submit" disabled={!isDirty || isSubmitting} className="btn-primary">
            {isSubmitting ? 'กำลังบันทึก…' : 'บันทึกโปรไฟล์'}
          </button>
        </form>
      </div>
    </Card>
  );
}

function PasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<PasswordForm>({ resolver: zodResolver(resetSchema), defaultValues: { password: '', confirm: '' } });
  const pw = useWatch({ control, name: 'password' }) ?? '';
  useEffect(() => {
    if (open) {
      reset({ password: '', confirm: '' });
      setFormError('');
    }
  }, [open, reset]);

  const submit = async ({ password }: PasswordForm) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setFormError(errorMessage(error, 'เปลี่ยนรหัสผ่านไม่สำเร็จ'));
    toast('เปลี่ยนรหัสผ่านแล้ว');
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="เปลี่ยนรหัสผ่าน"
      footer={
        <button type="submit" form="pw-form" disabled={isSubmitting} className="btn-primary w-full py-3">
          {isSubmitting ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}
        </button>
      }
    >
      <form id="pw-form" onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
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
      </form>
    </Sheet>
  );
}

export default function Account() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user)!;
  const signOut = useAuth((s) => s.signOut);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const provider = (user.app_metadata?.provider as string | undefined) ?? 'email';

  const task = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast(errorMessage(e), { kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const onImport = (file: File) =>
    task('import', async () => {
      if (file.size > 20 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 20 MB');
      const text = await file.text();
      const isJSON = file.name.toLowerCase().endsWith('.json');
      if (isJSON && !window.confirm('การนำเข้า JSON จะแทนที่ข้อมูลทั้งหมดในบัญชีนี้ ดำเนินการต่อ?')) return;
      try {
        const r = isJSON ? await importJSON(text) : await importCSV(text);
        await qc.invalidateQueries();
        toast(`นำเข้า ${r.transactions.toLocaleString('th-TH')} รายการ${r.skipped ? ` (ข้าม ${r.skipped} แถวที่ไม่ถูกต้อง)` : ''}`);
      } finally {
        if (fileRef.current) fileRef.current.value = '';
      }
    });

  return (
    <div className="space-y-6">
      <PageHeader title="บัญชีและข้อมูล" subtitle={user.email} />

      <ProfileCard />

      <Card title="ความปลอดภัย">
        <div className="flex flex-wrap gap-2">
          {provider === 'email' ? (
            <button type="button" className="btn-outline" onClick={() => setPwOpen(true)}>
              <KeyRound size={15} /> เปลี่ยนรหัสผ่าน
            </button>
          ) : (
            <p className="text-sm text-muted">บัญชีนี้เข้าสู่ระบบด้วย Google — จัดการรหัสผ่านที่บัญชี Google</p>
          )}
          <button type="button" className="btn-outline" onClick={() => void signOut()}>
            <LogOut size={15} /> ออกจากระบบ
          </button>
        </div>
      </Card>

      <Card title="สำรอง & นำเข้าข้อมูล">
        <p className="mb-4 text-sm text-muted">ดาวน์โหลดข้อมูลทั้งหมดของบัญชีนี้ หรือนำเข้าจากไฟล์</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline" disabled={!!busy} onClick={() => void task('json', async () => { await exportJSON(); toast('ส่งออก JSON แล้ว'); })}>
            <Download size={15} /> {busy === 'json' ? 'กำลังส่งออก…' : 'Export JSON (สำรองทั้งหมด)'}
          </button>
          <button type="button" className="btn-outline" disabled={!!busy} onClick={() => void task('csv', async () => { await exportCSV(); toast('ส่งออก CSV แล้ว'); })}>
            <Download size={15} /> {busy === 'csv' ? 'กำลังส่งออก…' : 'Export CSV (รายการ)'}
          </button>
          <button type="button" className="btn-outline" disabled={!!busy} onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> {busy === 'import' ? 'กำลังนำเข้า…' : 'Import CSV / JSON'}
          </button>
          <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && void onImport(e.target.files[0])} aria-label="เลือกไฟล์นำเข้า" />
        </div>
        <p className="mt-3 text-xs text-subtle">
          CSV ใช้คอลัมน์: date (yyyy-mm-dd), type (income/expense), amount, category, note, paymentMethod — เพิ่มต่อจากข้อมูลเดิม · JSON จะแทนที่ข้อมูลทั้งหมด (รองรับไฟล์สำรองจาก Coinly เวอร์ชันออฟไลน์ด้วย)
        </p>
      </Card>

      <Card title="โซนอันตราย" className="border-expense/25">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">ล้างข้อมูลทั้งหมด</p>
              <p className="text-xs text-subtle">ลบรายการ งบ เป้าหมาย รายการซ้ำ และหมวดหมู่ที่สร้างเอง (บัญชียังอยู่)</p>
            </div>
            <button type="button" className="btn-outline text-expense" onClick={() => setClearOpen(true)}>
              <RotateCcw size={15} /> ล้างข้อมูล
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <div>
              <p className="text-sm font-medium">ลบบัญชีถาวร</p>
              <p className="text-xs text-subtle">ลบบัญชีและข้อมูลทั้งหมด กู้คืนไม่ได้ แนะนำให้ Export สำรองก่อน</p>
            </div>
            <button type="button" className="btn bg-expense/15 text-expense hover:bg-expense/25" onClick={() => setDeleteOpen(true)}>
              <UserX size={15} /> ลบบัญชี
            </button>
          </div>
        </div>
      </Card>

      <PasswordSheet open={pwOpen} onClose={() => setPwOpen(false)} />
      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="ล้างข้อมูลทั้งหมด"
        description="รายการทั้งหมด งบประมาณ เป้าหมาย รายการซ้ำ และหมวดหมู่ที่สร้างเองจะถูกลบถาวร แล้วเริ่มใหม่ด้วยหมวดหมู่เริ่มต้น"
        phrase="ล้างข้อมูล"
        confirmLabel="ล้างข้อมูลทั้งหมด"
        onConfirm={async () => {
          try {
            await api.clearMyData('ล้างข้อมูล');
            await qc.invalidateQueries();
            toast('ล้างข้อมูลแล้ว', { kind: 'info' });
            return true;
          } catch (e) {
            toast(errorMessage(e), { kind: 'error' });
            return false;
          }
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="ลบบัญชีถาวร"
        description={`บัญชี ${user.email} และข้อมูลทั้งหมดจะถูกลบอย่างถาวร ไม่สามารถกู้คืนได้`}
        phrase="ลบบัญชี"
        confirmLabel="ลบบัญชีถาวร"
        onConfirm={async () => {
          try {
            await api.invokeFunction('delete-account', { confirm: 'ลบบัญชี' });
            await signOut();
            toast('ลบบัญชีเรียบร้อย ขอบคุณที่ใช้ Coinly', { kind: 'info' });
            navigate('/', { replace: true });
            return true;
          } catch (e) {
            toast(errorMessage(e, 'ลบบัญชีไม่สำเร็จ'), { kind: 'error' });
            return false;
          }
        }}
      />
    </div>
  );
}
