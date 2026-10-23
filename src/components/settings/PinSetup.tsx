import { useEffect, useState, type FormEvent } from 'react';
import { hashPin, newSalt, verifyPin } from '../../lib/pin';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/ui';
import { Sheet } from '../ui/Sheet';

/** ตั้ง/เปลี่ยน/ปิด PIN — ต้องยืนยัน PIN เดิมก่อนเปลี่ยนหรือปิด */
export function PinSetup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pinHash, pinSalt, setPin } = useSettings();
  const [current, setCurrent] = useState('');
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setCurrent('');
      setPinValue('');
      setConfirm('');
      setError('');
    }
  }, [open]);

  const checkCurrent = async () => !pinHash || !pinSalt || (await verifyPin(current, pinSalt, pinHash));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!(await checkCurrent())) return setError('PIN เดิมไม่ถูกต้อง');
    if (!/^\d{4}$/.test(pin)) return setError('PIN ต้องเป็นตัวเลข 4 หลัก');
    if (pin !== confirm) return setError('PIN ทั้งสองช่องไม่ตรงกัน');
    const salt = newSalt();
    setPin(await hashPin(pin, salt), salt);
    toast('ตั้งรหัส PIN แล้ว');
    onClose();
  };

  const disable = async () => {
    if (!(await checkCurrent())) return setError('PIN เดิมไม่ถูกต้อง');
    setPin(null, null);
    toast('ปิดการใช้ PIN แล้ว', { kind: 'info' });
    onClose();
  };

  const pinInput = (id: string, label: string, value: string, set: (v: string) => void) => (
    <label htmlFor={id} className="block space-y-1.5">
      <span className="label">{label}</span>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={value}
        onChange={(e) => set(e.target.value.replace(/\D/g, ''))}
        className="field num text-center text-xl tracking-[0.6em]"
      />
    </label>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={pinHash ? 'เปลี่ยนรหัส PIN' : 'ตั้งรหัส PIN'}
      footer={
        <div className="flex gap-2">
          {pinHash && (
            <button type="button" className="btn-outline text-expense" onClick={disable}>
              ปิด PIN
            </button>
          )}
          <button type="submit" form="pin-form" className="btn-primary flex-1 py-3">
            บันทึก PIN
          </button>
        </div>
      }
    >
      <form id="pin-form" onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">PIN จะถูกถามทุกครั้งที่เปิดแอป และเก็บในเครื่องแบบเข้ารหัสทางเดียว (hash) หากลืม PIN ต้องล้างข้อมูลเว็บไซต์ในเบราว์เซอร์</p>
        {pinHash && pinInput('pin-cur', 'PIN เดิม', current, setCurrent)}
        {pinInput('pin-new', 'PIN ใหม่ (4 หลัก)', pin, setPinValue)}
        {pinInput('pin-confirm', 'ยืนยัน PIN ใหม่', confirm, setConfirm)}
        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  );
}
