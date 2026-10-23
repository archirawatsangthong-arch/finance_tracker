import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useUI } from '../../store/ui';

/** ปุ่มลอย Quick Add มุมขวาล่าง (คีย์ลัด N) */
export function QuickAddButton() {
  const open = useUI((s) => s.openEditor);
  return (
    <motion.button
      type="button"
      onClick={() => open()}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      aria-label="เพิ่มรายการ (N)"
      aria-keyshortcuts="N"
      className="fixed bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-xl shadow-accent/40 ring-1 ring-white/20 lg:bottom-8 lg:right-8 lg:h-16 lg:w-16"
    >
      <Plus size={26} strokeWidth={2.5} />
    </motion.button>
  );
}
