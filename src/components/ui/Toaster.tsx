import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useUI, type ToastKind } from '../../store/ui';

const ICON: Record<ToastKind, { Icon: typeof Info; color: string }> = {
  success: { Icon: CheckCircle2, color: 'text-income' },
  error: { Icon: XCircle, color: 'text-expense' },
  warning: { Icon: AlertTriangle, color: 'text-warn' },
  info: { Icon: Info, color: 'text-accent-soft' },
};

/** Toast notification — ประกาศผ่าน aria-live ให้ screen reader อ่าน */
export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:top-auto lg:items-end lg:pr-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const { Icon, color } = ICON[t.kind];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className="glass-strong pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl px-4 py-3 text-sm"
            >
              <Icon size={18} className={`shrink-0 ${color}`} aria-hidden />
              <span className="flex-1">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-sm font-semibold text-accent-soft hover:bg-accent/10"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
