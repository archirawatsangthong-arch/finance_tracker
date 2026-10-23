import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { passwordStrength } from '../../lib/validation';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
}

/** ช่องกรอกพร้อม label + ข้อความ error (ผูก aria-describedby ให้ screen reader) */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, error, hint, type, className = '', ...rest }, ref) {
  const id = useId();
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const describedBy = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="label mb-1.5 block">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={ref}
          type={isPassword && show ? 'text' : type}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`field py-3 ${isPassword ? 'pr-11' : ''} ${error ? 'border-expense/60 focus:border-expense/60 focus:ring-expense/20' : ''}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-subtle hover:text-fg"
            aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {hint && !error && (
        <div id={`${id}-hint`} className="mt-1.5 text-xs text-subtle">
          {hint}
        </div>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-xs text-expense">
          {error}
        </p>
      )}
    </div>
  );
});

const STRENGTH = [
  { label: 'อ่อนมาก', color: 'bg-expense' },
  { label: 'อ่อน', color: 'bg-expense' },
  { label: 'พอใช้', color: 'bg-warn' },
  { label: 'ดี', color: 'bg-income' },
  { label: 'แข็งแรงมาก', color: 'bg-income' },
];

export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  const s = passwordStrength(value);
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition ${i < s ? STRENGTH[s].color : 'bg-fg/10'}`} />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-subtle">ความปลอดภัย: {STRENGTH[s].label}</p>
    </div>
  );
}

export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-subtle">
      <span className="h-px flex-1 bg-line" />
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
