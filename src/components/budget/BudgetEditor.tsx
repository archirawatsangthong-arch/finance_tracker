import { useEffect, useState } from 'react';
import { run } from '../../lib/actions';
import * as api from '../../lib/api';
import { formatDate } from '../../lib/format';
import { parseMoney } from '../../lib/validation';
import { useSettings } from '../../store/settings';
import type { Budget, Category } from '../../types';
import { CategoryIcon } from '../ui/CategoryIcon';
import { Sheet } from '../ui/Sheet';

interface Props {
  open: boolean;
  onClose: () => void;
  /** งบที่มีผลในเดือนนี้ */
  budgets: Budget[];
  categories: Category[];
  /** วันที่ 1 ของเดือนปัจจุบัน */
  month: string;
}

const ALL = '__all__';

/** ตั้งงบรายเดือน: งบรวม + งบแยกหมวด — มีผลตั้งแต่เดือนนี้เป็นต้นไป (เว้นว่าง = ยกเลิก) */
export function BudgetEditor({ open, onClose, budgets, categories, month }: Props) {
  const era = useSettings((s) => s.era);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(Object.fromEntries(budgets.map((b) => [b.categoryId ?? ALL, String(b.amount)])));
    setErrors({});
  }, [open, budgets]);

  const rows = [{ id: ALL, name: 'งบรวมทั้งเดือน', icon: 'wallet', color: '#8B5CF6' }, ...categories.filter((c) => c.type === 'expense')];
  const existing = new Map(budgets.map((b) => [b.categoryId ?? ALL, b.amount]));

  const save = async () => {
    const errs: Record<string, string> = {};
    const items: { categoryId: string | null; amount: number | null }[] = [];
    for (const r of rows) {
      const raw = (values[r.id] ?? '').trim();
      const amount = raw ? parseMoney(raw) : null;
      if (raw && amount === null) errs[r.id] = 'ต้องเป็นตัวเลขมากกว่า 0 ทศนิยมไม่เกิน 2 ตำแหน่ง';
      // ส่งเฉพาะหมวดที่เปลี่ยน
      if ((existing.get(r.id) ?? null) !== amount) items.push({ categoryId: r.id === ALL ? null : r.id, amount });
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (!items.length) return onClose();
    setSaving(true);
    const ok = await run(() => api.setBudgets(month, items), { success: 'บันทึกงบประมาณแล้ว', invalidate: [['budgets']] });
    setSaving(false);
    if (ok !== undefined) onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="ตั้งงบประมาณรายเดือน"
      footer={
        <button type="button" className="btn-primary w-full py-3" onClick={save} disabled={saving}>
          {saving ? 'กำลังบันทึก…' : 'บันทึกงบประมาณ'}
        </button>
      }
    >
      <p className="mb-4 text-sm text-muted">มีผลตั้งแต่{formatDate(month, era, 'month')}เป็นต้นไป · เว้นว่างไว้หากไม่ต้องการตั้งงบหมวดนั้น</p>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <div className="flex items-center gap-3">
              <CategoryIcon icon={r.icon} color={r.color} size="sm" />
              <label htmlFor={`b-${r.id}`} className={`flex-1 text-sm ${r.id === ALL ? 'font-semibold' : ''}`}>
                {r.name}
              </label>
              <div className="relative w-36">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle" aria-hidden>
                  ฿
                </span>
                <input
                  id={`b-${r.id}`}
                  type="text"
                  inputMode="decimal"
                  value={values[r.id] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [r.id]: e.target.value.replace(/[^\d.]/g, '') }))}
                  placeholder="—"
                  aria-invalid={!!errors[r.id]}
                  aria-describedby={errors[r.id] ? `b-${r.id}-err` : undefined}
                  className="field num pl-7 text-right"
                />
              </div>
            </div>
            {errors[r.id] && (
              <p id={`b-${r.id}-err`} role="alert" className="mt-1 text-right text-xs text-expense">
                {errors[r.id]}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
