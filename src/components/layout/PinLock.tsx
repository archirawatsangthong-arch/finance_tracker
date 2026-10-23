import { motion, useAnimationControls } from 'framer-motion';
import { Delete, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { verifyPin } from '../../lib/pin';
import { useSettings } from '../../store/settings';

const LENGTH = 4;

/** หน้าจอล็อกด้วย PIN 4 หลัก — รองรับทั้งแตะปุ่มและพิมพ์จากคีย์บอร์ด */
export function PinLock({ onUnlock }: { onUnlock: () => void }) {
  const { pinHash, pinSalt } = useSettings();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const shake = useAnimationControls();

  useEffect(() => {
    if (pin.length !== LENGTH || !pinHash || !pinSalt) return;
    void verifyPin(pin, pinSalt, pinHash).then((ok) => {
      if (ok) return onUnlock();
      const n = attempts + 1;
      setAttempts(n);
      // ใส่ผิด 5 ครั้งติด → พัก 30 วินาที
      if (n % 5 === 0) setLockedUntil(Date.now() + 30_000);
      setError(n % 5 === 0 ? 'ใส่ผิดหลายครั้ง กรุณารอ 30 วินาที' : 'PIN ไม่ถูกต้อง');
      setPin('');
      void shake.start({ x: [0, -12, 12, -8, 8, 0], transition: { duration: 0.4 } });
    });
  }, [pin, pinHash, pinSalt, onUnlock, attempts, shake]);

  const press = (d: string) => {
    if (Date.now() < lockedUntil) return;
    setError('');
    setPin((p) => (p.length < LENGTH ? p + d : p));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg px-6" role="dialog" aria-modal="true" aria-labelledby="pin-title">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent-soft">
        <Lock size={26} aria-hidden />
      </div>
      <h1 id="pin-title" className="text-xl font-semibold">
        ใส่รหัส PIN
      </h1>
      <p className="mt-1 h-5 text-sm text-expense" role="alert">
        {error}
      </p>
      <motion.div animate={shake} className="my-8 flex gap-4" aria-label={`ใส่แล้ว ${pin.length} จาก ${LENGTH} หลัก`}>
        {Array.from({ length: LENGTH }, (_, i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full transition ${i < pin.length ? 'scale-110 bg-accent shadow-[0_0_12px] shadow-accent' : 'bg-fg/15'}`} />
        ))}
      </motion.div>
      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={k}
              type="button"
              onClick={() => (k === 'del' ? setPin((p) => p.slice(0, -1)) : press(k))}
              aria-label={k === 'del' ? 'ลบ' : k}
              className="num glass h-16 rounded-2xl text-2xl font-medium transition active:scale-95"
            >
              {k === 'del' ? <Delete className="mx-auto" size={22} /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
