import { subDays } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import { useCategoryMap } from '../../hooks/useData';
import { todayISO, toISO } from '../../lib/date';
import { formatDate } from '../../lib/format';
import { useSettings } from '../../store/settings';
import type { Transaction } from '../../types';
import { Money } from '../ui/Money';
import { TransactionItem } from './TransactionItem';

interface Props {
  transactions: Transaction[];
  /** แสดงหัวข้อวันพร้อมยอดสุทธิรายวัน */
  grouped?: boolean;
}

/** รายการจัดกลุ่มตามวัน (มาจาก DB เรียงวันที่ล่าสุดก่อนแล้ว) */
export function TransactionList({ transactions, grouped = true }: Props) {
  const catMap = useCategoryMap();
  const era = useSettings((s) => s.era);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const arr = map.get(t.date);
      if (arr) arr.push(t);
      else map.set(t.date, [t]);
    }
    return [...map.entries()].map(([date, items]) => ({
      date,
      items: items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      net: items.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0),
    }));
  }, [transactions]);

  const today = todayISO();
  const yesterday = toISO(subDays(new Date(), 1));
  const dayLabel = (d: string) => (d === today ? 'วันนี้' : d === yesterday ? 'เมื่อวาน' : formatDate(d, era, 'day'));

  if (!grouped) {
    return (
      <ul className="space-y-0.5">
        <AnimatePresence initial={false}>
          {transactions.map((t) => (
            <motion.li key={t.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
              <TransactionItem tx={t} category={catMap.get(t.categoryId)} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.date} aria-label={dayLabel(g.date)}>
          <header className="sticky top-0 z-10 -mx-2 mb-1 flex items-center justify-between bg-bg/70 px-4 py-1.5 backdrop-blur-md lg:top-0">
            <h3 className="text-xs font-semibold text-muted">{dayLabel(g.date)}</h3>
            <Money value={g.net} sign className={`text-xs font-medium ${g.net >= 0 ? 'text-income' : 'text-muted'}`} />
          </header>
          <ul className="space-y-0.5">
            <AnimatePresence initial={false}>
              {g.items.map((t) => (
                <motion.li key={t.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}>
                  <TransactionItem tx={t} category={catMap.get(t.categoryId)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      ))}
    </div>
  );
}
