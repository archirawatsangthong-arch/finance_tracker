import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useIsDesktop } from '../../hooks/useEnv';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet บนมือถือ / modal กลางจอบนเดสก์ท็อป
 * - Esc เพื่อปิด, ดักโฟกัสไว้ภายใน (focus trap), คืนโฟกัสเมื่อปิด
 * - ลากลงเพื่อปิดบนมือถือ
 */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const desktop = useIsDesktop();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === 'Tab' && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="glass-strong relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl lg:max-w-lg lg:rounded-3xl"
            initial={desktop ? { opacity: 0, scale: 0.95, y: 10 } : { y: '100%' }}
            animate={desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={desktop ? { opacity: 0, scale: 0.95, y: 10 } : { y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            drag={desktop ? false : 'y'}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            {/* ลากจากแถบด้านบนเพื่อปิด (ไม่รบกวนการเลื่อนเนื้อหา) */}
            <div className="touch-none" onPointerDown={(e) => !desktop && dragControls.start(e)}>
            {!desktop && <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-fg/20" />}
            <header className="flex items-center justify-between px-5 pb-2 pt-4">
              <h2 id={titleId} className="text-base font-semibold">
                {title}
              </h2>
              <button type="button" onClick={onClose} className="btn-ghost -mr-2 p-2" aria-label="ปิด">
                <X size={18} />
              </button>
            </header>
            </div>
            <div className="overflow-y-auto overscroll-contain px-5 pb-4">
              {children}
            </div>
            {footer && <footer className="border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
