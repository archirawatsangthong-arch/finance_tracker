import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Sheet } from '../ui/Sheet';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  /** ข้อความที่ผู้ใช้ต้องพิมพ์ให้ตรงก่อนกดยืนยัน */
  phrase: string;
  confirmLabel: string;
  onConfirm: () => Promise<boolean>;
}

/** ยืนยันการกระทำที่ย้อนกลับไม่ได้ ด้วยการพิมพ์ข้อความยืนยัน */
export function ConfirmDialog({ open, onClose, title, description, phrase, confirmLabel, onConfirm }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setText('');
  }, [open]);
  const match = text.trim() === phrase;

  const confirm = async () => {
    if (!match) return;
    setBusy(true);
    const ok = await onConfirm();
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          <button type="button" className="btn-outline flex-1" onClick={onClose}>
            ยกเลิก
          </button>
          <button type="button" onClick={confirm} disabled={!match || busy} className="btn flex-1 bg-expense text-white hover:bg-red-500">
            {busy ? 'กำลังดำเนินการ…' : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-2xl border border-expense/30 bg-expense/10 p-4 text-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-expense" aria-hidden />
          <p>{description}</p>
        </div>
        <label className="block space-y-1.5">
          <span className="label">
            พิมพ์ <strong className="text-fg">{phrase}</strong> เพื่อยืนยัน
          </span>
          <input value={text} onChange={(e) => setText(e.target.value)} className="field" autoComplete="off" onKeyDown={(e) => e.key === 'Enter' && void confirm()} />
        </label>
      </div>
    </Sheet>
  );
}
