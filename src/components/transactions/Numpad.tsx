import { Delete } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
}

const KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '.', '0', '⌫', '+'] as const;
const OPS = new Set(['÷', '×', '−', '+']);
const KEY_LABEL: Record<string, string> = { '÷': 'หาร', '×': 'คูณ', '−': 'ลบ', '+': 'บวก', '⌫': 'ลบตัวอักษร', '.': 'จุดทศนิยม' };

/** ปุ่มตัวเลขที่คิดเลขได้ เช่น 120+45×2 */
export function Numpad({ value, onChange, onSubmit }: Props) {
  const press = (k: string) => {
    if (k === '⌫') return onChange(value.slice(0, -1));
    // ไม่ให้ใส่ตัวดำเนินการซ้อนกัน → แทนตัวเดิม
    if (OPS.has(k)) {
      if (!value) return;
      const last = value.at(-1)!;
      return onChange(OPS.has(last) ? value.slice(0, -1) + k : value + k);
    }
    if (k === '.') {
      const lastNum = value.split(/[÷×−+]/).at(-1) ?? '';
      if (lastNum.includes('.')) return;
      return onChange(value + (lastNum === '' ? '0.' : '.'));
    }
    // จำกัดทศนิยม 2 ตำแหน่ง
    const lastNum = value.split(/[÷×−+]/).at(-1) ?? '';
    if (/\.\d{2}$/.test(lastNum)) return;
    onChange(value === '0' ? k : value + k);
  };

  return (
    <div className="grid grid-cols-4 gap-2" role="group" aria-label="ปุ่มตัวเลข">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          onDoubleClick={k === '⌫' ? () => onChange('') : undefined}
          aria-label={KEY_LABEL[k] ?? k}
          className={`num h-12 rounded-xl text-lg font-medium transition active:scale-95 ${
            OPS.has(k) ? 'bg-accent/15 text-accent-soft hover:bg-accent/25' : 'bg-fg/5 hover:bg-fg/10'
          }`}
        >
          {k === '⌫' ? <Delete size={20} className="mx-auto" aria-hidden /> : k}
        </button>
      ))}
      {onSubmit && (
        <button type="button" onClick={onSubmit} className="btn-primary col-span-4 h-12 text-base">
          = คำนวณ
        </button>
      )}
    </div>
  );
}
