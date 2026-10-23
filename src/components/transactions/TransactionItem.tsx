import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { CloudUpload, Repeat, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { deleteTransaction } from '../../lib/actions';
import { paymentLabel } from '../../lib/categories';
import { useUI } from '../../store/ui';
import type { Category, Transaction } from '../../types';
import { CategoryIcon } from '../ui/CategoryIcon';
import { Money } from '../ui/Money';

interface Props {
  tx: Transaction;
  category?: Category;
  /** เปิดให้ปัดซ้ายเพื่อลบ (มือถือ) */
  swipeable?: boolean;
}

const THRESHOLD = -96;

/** แถวรายการ: คลิก/Enter เพื่อแก้ไข, ปัดซ้ายเพื่อลบ (มี Undo ใน toast), ปุ่มลบสำหรับคีย์บอร์ด */
export const TransactionItem = memo(function TransactionItem({ tx, category, swipeable = true }: Props) {
  const openEditor = useUI((s) => s.openEditor);
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [0, THRESHOLD], [0, 1]);
  const iconScale = useTransform(x, [0, THRESHOLD], [0.6, 1.1]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < THRESHOLD || info.velocity.x < -700) {
      animate(x, -window.innerWidth, { duration: 0.2 }).then(() => void deleteTransaction(tx));
    } else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
    }
  };

  const cat = category ?? { name: 'ไม่ระบุ', icon: 'tag', color: '#94A3B8' };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {swipeable && (
        <motion.div aria-hidden style={{ opacity: bgOpacity }} className="absolute inset-0 flex items-center justify-end rounded-xl bg-expense/90 pr-6 text-white">
          <motion.span style={{ scale: iconScale }}>
            <Trash2 size={20} />
          </motion.span>
        </motion.div>
      )}
      <motion.div
        style={{ x }}
        drag={swipeable ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.9, right: 0 }}
        onDragEnd={onDragEnd}
        className="group relative flex items-center gap-3 rounded-xl bg-bg/0 px-2 py-2.5 transition-colors hover:bg-fg/[0.04]"
      >
        <button
          type="button"
          onClick={() => openEditor(tx)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={`${cat.name} ${tx.note} แก้ไขรายการ`}
        >
          <CategoryIcon icon={cat.icon} color={cat.color} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 truncate text-sm font-medium">
              {tx.note || cat.name}
              {tx.recurringId && <Repeat size={12} className="shrink-0 text-subtle" aria-label="รายการซ้ำ" />}
              {tx.pending && <CloudUpload size={12} className="shrink-0 animate-pulse text-accent-soft" aria-label="กำลังบันทึก" />}
            </span>
            <span className="block truncate text-xs text-subtle">
              {cat.name} · {paymentLabel(tx.paymentMethod)}
            </span>
          </span>
          <Money value={tx.type === 'income' ? tx.amount : -tx.amount} sign className={`text-sm font-semibold ${tx.type === 'income' ? 'text-income' : 'text-fg'}`} />
        </button>
        <button
          type="button"
          onClick={() => void deleteTransaction(tx)}
          className="btn-ghost hidden p-2 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 lg:inline-flex"
          aria-label="ลบรายการ"
        >
          <Trash2 size={15} />
        </button>
      </motion.div>
    </div>
  );
});
