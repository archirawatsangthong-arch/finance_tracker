import { Loader2, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { TransactionList } from '../components/transactions/TransactionList';
import { Card, PageHeader, Skeleton } from '../components/ui/Card';
import { CategoryIcon } from '../components/ui/CategoryIcon';
import { EmptyState } from '../components/ui/EmptyState';
import { Money } from '../components/ui/Money';
import { useCategories, useTxSearch, useTxSearchTotals } from '../hooks/useData';
import { useUI } from '../store/ui';
import type { TxFilters } from '../types';

const EMPTY: TxFilters = { query: '', type: 'all', categories: [], start: '', end: '', min: '', max: '' };

// ช่องจำนวนเงิน: รับเฉพาะตัวเลขบวก (ค่าอื่นไม่ส่งไปค้นหา)
const cleanMoney = (v: string) => (/^\d+(\.\d{0,2})?$/.test(v) ? v : '');

export default function Transactions() {
  const categories = useCategories() ?? [];
  const openEditor = useUI((s) => s.openEditor);
  const searchFocus = useUI((s) => s.searchFocus);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Omit<TxFilters, 'query'>>(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const q = useDeferredValue(query.trim());

  // คีย์ลัด "/" สั่ง focus ช่องค้นหา
  useEffect(() => {
    if (searchFocus) searchRef.current?.focus();
  }, [searchFocus]);

  // ค้นหาฝั่ง server (หน่วงเวลาเล็กน้อยระหว่างพิมพ์)
  const [debounced, setDebounced] = useState<TxFilters>(EMPTY);
  useEffect(() => {
    const t = setTimeout(() => setDebounced({ ...filters, query: q, min: cleanMoney(filters.min), max: cleanMoney(filters.max) }), 250);
    return () => clearTimeout(t);
  }, [q, filters]);

  const search = useTxSearch(debounced);
  const totalsQ = useTxSearchTotals(debounced);
  const items = useMemo(() => search.data?.pages.flat() ?? [], [search.data]);
  const sum = totalsQ.data ?? { income: 0, expense: 0, net: 0, count: 0 };
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const isFiltered = JSON.stringify(debounced) !== JSON.stringify(EMPTY);

  const activeCount =
    (filters.type !== 'all' ? 1 : 0) + filters.categories.length + (filters.start || filters.end ? 1 : 0) + (filters.min || filters.max ? 1 : 0);

  const toggleCat = (id: string) =>
    setFilters((f) => ({ ...f, categories: f.categories.includes(id) ? f.categories.filter((c) => c !== id) : [...f.categories, id] }));

  const clearAll = () => {
    setQuery('');
    setFilters(EMPTY);
  };

  return (
    <div>
      <PageHeader
        title="รายการทั้งหมด"
        subtitle={totalsQ.data ? `${sum.count.toLocaleString('th-TH')} รายการ` : 'กำลังโหลด…'}
        action={
          <button type="button" className="btn-primary hidden lg:inline-flex" onClick={() => openEditor()}>
            <Plus size={16} /> เพิ่มรายการ
          </button>
        }
      />

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" aria-hidden />
          <label htmlFor="search" className="sr-only">
            ค้นหารายการ
          </label>
          <input
            id="search"
            ref={searchRef}
            type="search"
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setQuery('');
                e.currentTarget.blur();
              }
            }}
            placeholder="ค้นหาโน้ต หมวดหมู่ จำนวนเงิน… ( / )"
            className="field py-3 pl-10"
            aria-keyshortcuts="/"
          />
          {search.isFetching && !search.isFetchingNextPage && (
            <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-subtle" aria-label="กำลังค้นหา" />
          )}
        </div>
        <button type="button" onClick={() => setShowFilters((v) => !v)} className="btn-outline relative" aria-expanded={showFilters} aria-controls="filters">
          <SlidersHorizontal size={16} />
          <span className="hidden sm:inline">ตัวกรอง</span>
          {activeCount > 0 && <span className="num absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] text-white">{activeCount}</span>}
        </button>
      </div>

      {showFilters && (
        <Card as="div" className="mb-4 space-y-4">
          <div id="filters" className="space-y-4">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="ประเภท">
              {(['all', 'expense', 'income'] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={filters.type === t} onClick={() => setFilters((f) => ({ ...f, type: t }))} className="chip">
                  {t === 'all' ? 'ทั้งหมด' : t === 'income' ? 'รายรับ' : 'รายจ่าย'}
                </button>
              ))}
            </div>
            <div>
              <p className="label mb-2">หมวดหมู่</p>
              <div className="flex flex-wrap gap-2">
                {categories
                  .filter((c) => filters.type === 'all' || c.type === filters.type)
                  .map((c) => (
                    <button key={c.id} type="button" aria-pressed={filters.categories.includes(c.id)} onClick={() => toggleCat(c.id)} className="chip">
                      <span className="h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden />
                      {c.name}
                    </button>
                  ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="label space-y-1.5">
                <span className="block">ตั้งแต่วันที่</span>
                <input type="date" value={filters.start} max={filters.end || undefined} onChange={(e) => setFilters((f) => ({ ...f, start: e.target.value }))} className="field" />
              </label>
              <label className="label space-y-1.5">
                <span className="block">ถึงวันที่</span>
                <input type="date" value={filters.end} min={filters.start || undefined} onChange={(e) => setFilters((f) => ({ ...f, end: e.target.value }))} className="field" />
              </label>
              <label className="label space-y-1.5">
                <span className="block">จำนวนขั้นต่ำ</span>
                <input type="number" inputMode="decimal" min={0} value={filters.min} onChange={(e) => setFilters((f) => ({ ...f, min: e.target.value }))} placeholder="0" className="field num" />
              </label>
              <label className="label space-y-1.5">
                <span className="block">จำนวนสูงสุด</span>
                <input type="number" inputMode="decimal" min={0} value={filters.max} onChange={(e) => setFilters((f) => ({ ...f, max: e.target.value }))} placeholder="ไม่จำกัด" className="field num" />
              </label>
            </div>
            {activeCount > 0 && (
              <button type="button" onClick={() => setFilters(EMPTY)} className="btn-ghost -ml-2 text-xs">
                <X size={14} /> ล้างตัวกรอง
              </button>
            )}
          </div>
        </Card>
      )}

      {filters.categories.length > 0 && !showFilters && (
        <div className="mb-4 flex flex-wrap gap-2">
          {filters.categories.map((id) => {
            const c = catMap.get(id);
            return c ? (
              <button key={id} type="button" onClick={() => toggleCat(id)} className="chip" aria-label={`เอาตัวกรอง ${c.name} ออก`}>
                <CategoryIcon icon={c.icon} color={c.color} size="sm" /> {c.name} <X size={12} />
              </button>
            ) : null;
          })}
        </div>
      )}

      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: 'รายรับ', v: sum.income, c: 'text-income' },
          { label: 'รายจ่าย', v: sum.expense, c: 'text-expense' },
          { label: 'สุทธิ', v: sum.net, c: '' },
        ].map((x) => (
          <div key={x.label} className="glass rounded-2xl px-4 py-3">
            <p className="text-[11px] text-muted">{x.label}</p>
            {totalsQ.data ? <Money value={x.v} className={`text-sm font-semibold sm:text-base ${x.c}`} /> : <Skeleton className="mt-1 h-5 w-20" />}
          </div>
        ))}
      </div>

      <Card as="div" className="px-3 sm:px-5">
        {search.isPending ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : search.isError && !items.length ? (
          <EmptyState
            title="โหลดรายการไม่สำเร็จ"
            description="ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองอีกครั้ง"
            action={
              <button type="button" className="btn-outline" onClick={() => void search.refetch()}>
                ลองใหม่
              </button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            title={isFiltered ? 'ไม่พบรายการที่ตรงกัน' : 'ยังไม่มีรายการ'}
            description={isFiltered ? 'ลองเปลี่ยนคำค้นหรือตัวกรองดูนะ' : 'กดปุ่ม + หรือกด N เพื่อเพิ่มรายการแรก'}
            action={
              isFiltered ? (
                <button type="button" className="btn-outline" onClick={clearAll}>
                  ล้างการค้นหา
                </button>
              ) : (
                <button type="button" className="btn-primary" onClick={() => openEditor()}>
                  <Plus size={16} /> เพิ่มรายการแรก
                </button>
              )
            }
          />
        ) : (
          <>
            <TransactionList transactions={items} />
            {search.hasNextPage && (
              <div className="mt-4 text-center">
                <button type="button" className="btn-outline" disabled={search.isFetchingNextPage} onClick={() => void search.fetchNextPage()}>
                  {search.isFetchingNextPage ? <Loader2 size={15} className="animate-spin" /> : null}
                  โหลดเพิ่ม ({Math.max(0, sum.count - items.length).toLocaleString('th-TH')})
                </button>
              </div>
            )}
          </>
        )}
      </Card>
      <p className="mt-3 text-center text-xs text-subtle lg:hidden">เคล็ดลับ: ปัดรายการไปทางซ้ายเพื่อลบ</p>
    </div>
  );
}
