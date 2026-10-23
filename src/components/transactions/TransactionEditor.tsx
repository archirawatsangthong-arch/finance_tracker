import { Calculator, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useCategories } from '../../hooks/useData';
import { deleteTransaction, saveTransaction } from '../../lib/actions';
import { tryEvaluate } from '../../lib/calculator';
import { errorMessage } from '../../lib/errors';
import { PAYMENT_METHODS } from '../../lib/categories';
import { todayISO } from '../../lib/date';
import { formatMoney } from '../../lib/format';
import { parseNaturalInput } from '../../lib/parser';
import { FREQ_LABEL } from '../../lib/recurring';
import { useUI } from '../../store/ui';
import type { Frequency, PaymentMethod, Transaction, TxType } from '../../types';
import { CategoryIcon } from '../ui/CategoryIcon';
import { Sheet } from '../ui/Sheet';
import { Numpad } from './Numpad';

interface FormState {
  type: TxType;
  amountExpr: string;
  categoryId: string;
  date: string;
  note: string;
  paymentMethod: PaymentMethod;
  repeat: Frequency | '';
}

const emptyForm = (): FormState => ({
  type: 'expense',
  amountExpr: '',
  categoryId: '',
  date: todayISO(),
  note: '',
  paymentMethod: 'cash',
  repeat: '',
});

const fromTx = (t: Transaction): FormState => ({
  type: t.type,
  amountExpr: String(t.amount),
  categoryId: t.categoryId,
  date: t.date,
  note: t.note,
  paymentMethod: t.paymentMethod,
  repeat: '',
});

/** Quick Add / แก้ไขรายการ — ออกแบบให้เพิ่มรายการได้ภายใน 3 วินาที (พิมพ์ "กาแฟ 65" แล้วกด Enter) */
export function TransactionEditor() {
  const editor = useUI((s) => s.editor);
  const close = useUI((s) => s.closeEditor);
  const categories = useCategories() ?? [];
  const editing = editor && editor !== 'new' ? editor : null;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [smart, setSmart] = useState('');
  const [showPad, setShowPad] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const smartRef = useRef<HTMLInputElement>(null);

  // รีเซ็ตฟอร์มทุกครั้งที่เปิด
  useEffect(() => {
    if (!editor) return;
    setForm(editing ? fromTx(editing) : emptyForm());
    setSmart('');
    setError('');
    setShowPad(false);
    if (!editing) setTimeout(() => smartRef.current?.focus(), 80);
  }, [editor, editing]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const typeCats = useMemo(() => categories.filter((c) => c.type === form.type), [categories, form.type]);
  const amount = tryEvaluate(form.amountExpr);
  const isExpr = /[+\-×÷*/−]/.test(form.amountExpr.replace(/^-/, ''));

  // แยกข้อความอัจฉริยะแบบสด แล้วเติมฟอร์มให้
  const onSmartChange = (text: string) => {
    setSmart(text);
    const p = parseNaturalInput(text, categories);
    setForm((f) => {
      const type = p.type ?? f.type;
      const fallback = categories.find((c) => c.type === type && c.systemKey)?.id ?? '';
      const keepCat = categories.find((c) => c.id === f.categoryId)?.type === type ? f.categoryId : fallback;
      return {
        ...f,
        type,
        amountExpr: p.amount !== null ? String(p.amount) : f.amountExpr,
        categoryId: p.categoryId ?? keepCat,
        note: p.note || f.note,
      };
    });
  };

  const switchType = (type: TxType) => {
    setForm((f) => ({ ...f, type, categoryId: categories.find((c) => c.id === f.categoryId)?.type === type ? f.categoryId : '' }));
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (amount === null || amount <= 0) return setError('กรุณาใส่จำนวนเงินที่มากกว่า 0');
    if (amount > 9_999_999_999.99) return setError('จำนวนเงินมากเกินไป');
    const categoryId = form.categoryId || typeCats.find((c) => c.systemKey)?.id || typeCats[0]?.id;
    if (!categoryId) return setError('กรุณาเลือกหมวดหมู่');
    setSaving(true);
    try {
      const input = { type: form.type, amount, categoryId, date: form.date || todayISO(), note: form.note.trim().slice(0, 200), paymentMethod: form.paymentMethod };
      if (form.repeat && !editing) {
        // รายการซ้ำต้องรอ server — ปิดฟอร์มเมื่อสำเร็จ
        await saveTransaction(input, { repeat: form.repeat });
        close();
      } else {
        // optimistic: ปิดฟอร์มทันที รายการขึ้นบนจอเลย (ถ้า server ปฏิเสธจะย้อนกลับพร้อมปุ่มลองใหม่)
        close();
        void saveTransaction(input, { id: editing?.id });
      }
    } catch (e) {
      setError(errorMessage(e, 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    close();
    await deleteTransaction(editing);
  };

  const typeColor = form.type === 'income' ? 'text-income' : 'text-expense';

  return (
    <Sheet
      open={!!editor}
      onClose={close}
      title={editing ? 'แก้ไขรายการ' : 'เพิ่มรายการ'}
      footer={
        <div className="flex gap-2">
          {editing && (
            <button type="button" onClick={remove} className="btn-outline text-expense" aria-label="ลบรายการ">
              <Trash2 size={16} />
            </button>
          )}
          <button type="submit" form="tx-form" disabled={saving} className="btn-primary flex-1 py-3 text-base">
            {editing ? 'บันทึกการแก้ไข' : 'บันทึก'}
            {amount !== null && amount > 0 && <span className="num opacity-80">· {formatMoney(amount)}</span>}
          </button>
        </div>
      }
    >
      <form id="tx-form" onSubmit={submit} className="space-y-5" noValidate>
        {!editing && (
          <div>
            <label htmlFor="smart" className="label mb-1.5 flex items-center gap-1.5">
              <Sparkles size={13} className="text-accent-soft" aria-hidden /> พิมพ์เร็ว
            </label>
            <input
              id="smart"
              ref={smartRef}
              value={smart}
              onChange={(e) => onSmartChange(e.target.value)}
              placeholder='เช่น "กาแฟ 65" หรือ "เงินเดือน +35000"'
              className="field py-3 text-base"
              autoComplete="off"
              enterKeyHint="done"
              aria-describedby="smart-hint"
            />
            <p id="smart-hint" className="mt-1.5 text-xs text-subtle">
              ระบบจะแยกจำนวนเงินและหมวดหมู่ให้อัตโนมัติ แล้วกด Enter เพื่อบันทึก
            </p>
          </div>
        )}

        {/* ประเภท */}
        <div role="radiogroup" aria-label="ประเภทรายการ" className="grid grid-cols-2 gap-1 rounded-xl bg-fg/5 p-1">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={form.type === t}
              onClick={() => switchType(t)}
              className={`rounded-lg py-2 text-sm font-medium transition ${
                form.type === t ? (t === 'income' ? 'bg-income/20 text-income' : 'bg-expense/20 text-expense') : 'text-muted hover:text-fg'
              }`}
            >
              {t === 'income' ? 'รายรับ' : 'รายจ่าย'}
            </button>
          ))}
        </div>

        {/* จำนวนเงิน */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="amount" className="label">
              จำนวนเงิน
            </label>
            <button type="button" onClick={() => setShowPad((v) => !v)} className="chip" aria-pressed={showPad} aria-controls="numpad">
              <Calculator size={13} aria-hidden /> เครื่องคิดเลข
            </button>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className={`text-2xl font-semibold ${typeColor}`} aria-hidden>
              ฿
            </span>
            <input
              id="amount"
              value={form.amountExpr}
              onChange={(e) => {
                set('amountExpr', e.target.value.replace(/[^\d.+\-*/×÷−() ]/g, ''));
                setError('');
              }}
              inputMode={showPad ? 'none' : 'decimal'}
              placeholder="0.00"
              className={`num w-full bg-transparent text-4xl font-semibold tracking-tight outline-none placeholder:text-fg/20 ${typeColor}`}
              aria-invalid={!!error}
              aria-describedby={error ? 'amount-error' : undefined}
              autoComplete="off"
            />
          </div>
          {isExpr && (
            <p className="num mt-1 text-sm text-muted" aria-live="polite">
              = {amount !== null ? formatMoney(amount) : 'นิพจน์ไม่ถูกต้อง'}
            </p>
          )}
          {error && (
            <p id="amount-error" role="alert" className="mt-1 text-sm text-expense">
              {error}
            </p>
          )}
          {showPad && (
            <div id="numpad" className="mt-3">
              <Numpad
                value={form.amountExpr}
                onChange={(v) => set('amountExpr', v)}
                onSubmit={isExpr && amount !== null ? () => set('amountExpr', String(amount)) : undefined}
              />
            </div>
          )}
        </div>

        {/* หมวดหมู่ */}
        <fieldset>
          <legend className="label mb-2">หมวดหมู่</legend>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="หมวดหมู่">
            {typeCats.map((c) => {
              const on = form.categoryId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set('categoryId', c.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-[11px] leading-tight transition ${
                    on ? 'border-accent/60 bg-accent/10 text-fg' : 'border-transparent text-muted hover:bg-fg/5'
                  }`}
                >
                  <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                  <span className="line-clamp-1">{c.name}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="date" className="label mb-1.5 block">
              วันที่
            </label>
            <input id="date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="field" />
          </div>
          {!editing ? (
            <div>
              <label htmlFor="repeat" className="label mb-1.5 block">
                ทำซ้ำ
              </label>
              <select id="repeat" value={form.repeat} onChange={(e) => set('repeat', e.target.value as Frequency | '')} className="field">
                <option value="">ไม่ซ้ำ</option>
                {(Object.keys(FREQ_LABEL) as Frequency[]).map((f) => (
                  <option key={f} value={f}>
                    {FREQ_LABEL[f]}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div />
          )}
        </div>

        <fieldset>
          <legend className="label mb-2">วิธีชำระเงิน</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="วิธีชำระเงิน">
            {PAYMENT_METHODS.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={form.paymentMethod === p.id} onClick={() => set('paymentMethod', p.id)} className="chip">
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="note" className="label mb-1.5 block">
            โน้ต
          </label>
          <input id="note" value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={200} placeholder="รายละเอียดเพิ่มเติม" className="field" />
        </div>
      </form>
    </Sheet>
  );
}
