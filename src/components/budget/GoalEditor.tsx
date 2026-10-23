import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { run } from '../../lib/actions';
import * as api from '../../lib/api';
import { getIcon, PALETTE } from '../../lib/icons';
import { qk } from '../../lib/queryClient';
import { goalSchema } from '../../lib/validation';
import { toast } from '../../store/ui';
import type { Goal } from '../../types';
import { Sheet } from '../ui/Sheet';

const GOAL_ICONS = ['plane', 'piggy', 'laptop', 'house', 'car', 'education', 'gift', 'health', 'smartphone', 'sparkles'];

type Form = z.infer<typeof goalSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  goal: Goal | null;
}

/** สร้าง/แก้ไขเป้าหมายการออม */
export function GoalEditor({ open, onClose, goal }: Props) {
  const [icon, setIcon] = useState('piggy');
  const [color, setColor] = useState(PALETTE[5]);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(goalSchema) });

  useEffect(() => {
    if (!open) return;
    reset({ name: goal?.name ?? '', target: goal ? String(goal.target) : '', saved: goal ? String(goal.saved) : '', deadline: goal?.deadline ?? '' });
    setIcon(goal?.icon ?? 'piggy');
    setColor(goal?.color ?? PALETTE[5]);
  }, [open, goal, reset]);

  const submit = async (v: Form) => {
    const data = { name: v.name, target: Number(v.target), saved: Number(v.saved || 0), deadline: v.deadline || null, icon, color };
    const ok = await run(() => api.saveGoal(data, goal?.id), { success: goal ? 'แก้ไขเป้าหมายแล้ว' : 'สร้างเป้าหมายแล้ว', invalidate: [qk.goals] });
    if (ok !== undefined) onClose();
  };

  const remove = async () => {
    if (!goal) return;
    const ok = await run(() => api.deleteGoal(goal.id), { invalidate: [qk.goals] });
    if (ok === undefined) return;
    onClose();
    toast('ลบเป้าหมายแล้ว', {
      kind: 'info',
      action: { label: 'เลิกทำ', onClick: () => void run(() => api.restoreGoal(goal), { success: 'กู้คืนเป้าหมายแล้ว', invalidate: [qk.goals] }) },
    });
  };

  const err = (m?: string) =>
    m && (
      <p role="alert" className="mt-1 text-xs text-expense">
        {m}
      </p>
    );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={goal ? 'แก้ไขเป้าหมาย' : 'เป้าหมายใหม่'}
      footer={
        <div className="flex gap-2">
          {goal && (
            <button type="button" className="btn-outline text-expense" onClick={remove} aria-label="ลบเป้าหมาย">
              <Trash2 size={16} />
            </button>
          )}
          <button type="submit" form="goal-form" className="btn-primary flex-1 py-3" disabled={isSubmitting}>
            {isSubmitting ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      }
    >
      <form id="goal-form" onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <label className="block space-y-1.5">
          <span className="label">ชื่อเป้าหมาย</span>
          <input {...register('name')} placeholder="เช่น เที่ยวญี่ปุ่น" className="field" maxLength={60} aria-invalid={!!errors.name} />
          {err(errors.name?.message)}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="label">ยอดเป้าหมาย (฿)</span>
            <input {...register('target')} inputMode="decimal" placeholder="50000" className="field num" aria-invalid={!!errors.target} />
            {err(errors.target?.message)}
          </label>
          <label className="block space-y-1.5">
            <span className="label">ออมแล้ว (฿)</span>
            <input {...register('saved')} inputMode="decimal" placeholder="0" className="field num" aria-invalid={!!errors.saved} />
            {err(errors.saved?.message)}
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="label">วันที่ต้องการถึงเป้า (ไม่บังคับ)</span>
          <input type="date" {...register('deadline')} className="field" />
        </label>
        <fieldset>
          <legend className="label mb-2">ไอคอน</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="ไอคอน">
            {GOAL_ICONS.map((i) => {
              const Icon = getIcon(i);
              return (
                <button key={i} type="button" role="radio" aria-checked={icon === i} aria-label={i} onClick={() => setIcon(i)} className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${icon === i ? 'border-accent bg-accent/15' : 'border-line hover:bg-fg/5'}`}>
                  <Icon size={18} style={{ color }} />
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label mb-2">สี</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="สี">
            {PALETTE.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)} className={`h-8 w-8 rounded-full transition ${color === c ? 'scale-110 ring-2 ring-fg ring-offset-2 ring-offset-bg' : ''}`} style={{ background: c }} />
            ))}
          </div>
        </fieldset>
      </form>
    </Sheet>
  );
}
