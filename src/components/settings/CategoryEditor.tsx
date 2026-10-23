import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { invalidateMoney, qk } from '../../lib/queryClient';
import { run } from '../../lib/actions';
import * as api from '../../lib/api';
import { ICONS, PALETTE } from '../../lib/icons';
import { categorySchema } from '../../lib/validation';
import type { Category, TxType } from '../../types';
import { CategoryIcon } from '../ui/CategoryIcon';
import { Sheet } from '../ui/Sheet';

type Form = z.infer<typeof categorySchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  category: Category | null;
  defaultType: TxType;
  count: number;
}

/** เพิ่ม/แก้ไขหมวดหมู่: ชื่อ, ประเภท, ไอคอน, สี, คำค้นสำหรับพิมพ์เร็ว */
export function CategoryEditor({ open, onClose, category, defaultType, count }: Props) {
  const [type, setType] = useState<TxType>(defaultType);
  const [icon, setIcon] = useState('tag');
  const [color, setColor] = useState(PALETTE[0]);
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(categorySchema) });
  const name = watch('name');

  useEffect(() => {
    if (!open) return;
    reset({ name: category?.name ?? '', keywords: category?.keywords.join(', ') ?? '' });
    setType(category?.type ?? defaultType);
    setIcon(category?.icon ?? 'tag');
    setColor(category?.color ?? PALETTE[Math.floor(Math.random() * PALETTE.length)]);
  }, [open, category, defaultType, reset]);

  const submit = async (v: Form) => {
    const keywords = v.keywords.split(/[,\n]/).map((k) => k.trim()).filter(Boolean).slice(0, 50);
    const ok = await run(() => api.saveCategory({ name: v.name, type, icon, color, keywords, order: count }, category?.id), {
      success: category ? 'แก้ไขหมวดหมู่แล้ว' : 'เพิ่มหมวดหมู่แล้ว',
      invalidate: [qk.categories],
    });
    if (ok !== undefined) onClose();
  };

  const remove = async () => {
    if (!category) return;
    const used = await run(() => api.countCategoryUsage(category.id));
    if (used === undefined) return;
    const fallback = category.type === 'income' ? 'รายรับอื่น ๆ' : 'อื่น ๆ';
    const msg = used > 0 ? `มี ${used} รายการใช้หมวดนี้อยู่ จะถูกย้ายไปหมวด "${fallback}" แล้วลบหมวดนี้ ดำเนินการต่อ?` : `ลบหมวด "${category.name}"?`;
    if (!window.confirm(msg)) return;
    const ok = await run(() => api.deleteCategory(category.id), { success: 'ลบหมวดหมู่แล้ว', invalidate: [qk.categories, qk.recurring, ['budgets']] });
    if (ok === undefined) return;
    void invalidateMoney();
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={category ? 'แก้ไขหมวดหมู่' : 'หมวดหมู่ใหม่'}
      footer={
        <div className="flex gap-2">
          {category && !category.systemKey && (
            <button type="button" className="btn-outline text-expense" onClick={remove} aria-label="ลบหมวดหมู่">
              <Trash2 size={16} />
            </button>
          )}
          <button type="submit" form="cat-form" className="btn-primary flex-1 py-3" disabled={isSubmitting}>
            {isSubmitting ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      }
    >
      <form id="cat-form" onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="flex items-start gap-3">
          <CategoryIcon icon={icon} color={color} size="lg" />
          <label className="flex-1 space-y-1.5">
            <span className="label">ชื่อหมวดหมู่</span>
            <input {...register('name')} className="field" maxLength={40} placeholder="เช่น สัตว์เลี้ยง" aria-invalid={!!errors.name} />
            {errors.name && (
              <span role="alert" className="block text-xs text-expense">
                {errors.name.message}
              </span>
            )}
          </label>
        </div>
        {category ? (
          <p className="text-xs text-subtle">
            ประเภท: {category.type === 'income' ? 'รายรับ' : 'รายจ่าย'} (เปลี่ยนไม่ได้หลังสร้าง){category.systemKey && ' · หมวดสำรอง ลบไม่ได้'}
          </p>
        ) : (
          <div role="radiogroup" aria-label="ประเภท" className="grid grid-cols-2 gap-1 rounded-xl bg-fg/5 p-1">
            {(['expense', 'income'] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)} className={`rounded-lg py-2 text-sm font-medium ${type === t ? 'bg-accent/20 text-fg' : 'text-muted'}`}>
                {t === 'income' ? 'รายรับ' : 'รายจ่าย'}
              </button>
            ))}
          </div>
        )}
        <fieldset>
          <legend className="label mb-2">ไอคอน</legend>
          <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="ไอคอน">
            {Object.entries(ICONS).map(([key, Icon]) => (
              <button key={key} type="button" role="radio" aria-checked={icon === key} aria-label={key} onClick={() => setIcon(key)} className={`flex aspect-square items-center justify-center rounded-lg border transition ${icon === key ? 'border-accent bg-accent/15' : 'border-transparent hover:bg-fg/5'}`}>
                <Icon size={17} style={{ color: icon === key ? color : undefined }} />
              </button>
            ))}
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
        <label className="block space-y-1.5">
          <span className="label">คำค้นสำหรับพิมพ์เร็ว (คั่นด้วย ,)</span>
          <textarea {...register('keywords')} rows={2} maxLength={1000} className="field resize-none" placeholder={`เช่น ${name || 'อาหารแมว'}, ทราย, หมอหมา`} />
          {errors.keywords && (
            <span role="alert" className="block text-xs text-expense">
              {errors.keywords.message}
            </span>
          )}
        </label>
      </form>
    </Sheet>
  );
}
