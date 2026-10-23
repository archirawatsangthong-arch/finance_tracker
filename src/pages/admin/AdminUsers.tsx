import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, Search, ShieldCheck, ShieldOff, UserCheck, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Avatar } from '../../components/layout/UserMenu';
import { Card, PageHeader, Skeleton } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { useUserId } from '../../hooks/useData';
import { listUsers, setRole, setSuspended, type AdminUser } from '../../lib/adminApi';
import { errorMessage } from '../../lib/errors';
import { formatDate } from '../../lib/format';
import { qk } from '../../lib/queryClient';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/ui';
import type { Role } from '../../types';

const PAGE = 20;

function relative(iso: string | null): string {
  if (!iso) return 'ยังไม่เคยใช้งาน';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return m <= 1 ? 'เมื่อสักครู่' : `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d} วันที่แล้ว` : `${Math.floor(d / 30)} เดือนที่แล้ว`;
}

export default function AdminUsers() {
  const qc = useQueryClient();
  const me = useUserId();
  const era = useSettings((s) => s.era);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [role, setRoleFilter] = useState<Role | null>(null);
  const [status, setStatus] = useState<'active' | 'suspended' | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(query);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const list = useQuery({
    queryKey: [...qk.admin, 'users', debounced, role, status, page],
    queryFn: () => listUsers({ query: debounced, role, status, limit: PAGE, offset: page * PAGE }),
    placeholderData: keepPreviousData,
  });
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const act = async (u: AdminUser, kind: 'suspend' | 'role') => {
    const msg =
      kind === 'suspend'
        ? u.isSuspended
          ? `เปิดใช้งานบัญชี ${u.email} อีกครั้ง?`
          : `ระงับบัญชี ${u.email}? ผู้ใช้จะเข้าสู่ระบบและเข้าถึงข้อมูลไม่ได้จนกว่าจะเปิดใช้งาน`
        : u.role === 'admin'
          ? `ถอดสิทธิ์ผู้ดูแลระบบของ ${u.email}?`
          : `ตั้ง ${u.email} เป็นผู้ดูแลระบบ? ผู้ดูแลจะเห็นรายชื่อผู้ใช้และสถิติรวมได้`;
    if (!window.confirm(msg)) return;
    setBusy(u.id + kind);
    try {
      if (kind === 'suspend') await setSuspended(u.id, !u.isSuspended);
      else await setRole(u.id, u.role === 'admin' ? 'user' : 'admin');
      await qc.invalidateQueries({ queryKey: qk.admin });
      toast(kind === 'suspend' ? (u.isSuspended ? 'เปิดใช้งานบัญชีแล้ว' : 'ระงับบัญชีแล้ว') : 'เปลี่ยนสิทธิ์แล้ว');
    } catch (e) {
      toast(errorMessage(e, 'ดำเนินการไม่สำเร็จ'), { kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const chip = <T,>(value: T, current: T, set: (v: T) => void, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={current === value}
      onClick={() => {
        set(value);
        setPage(0);
      }}
      className="chip"
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      <PageHeader title="จัดการผู้ใช้" subtitle={list.data ? `${total.toLocaleString('th-TH')} บัญชี` : 'กำลังโหลด…'} />

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" aria-hidden />
        <label htmlFor="user-search" className="sr-only">
          ค้นหาผู้ใช้
        </label>
        <input id="user-search" type="search" value={query} maxLength={100} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาด้วยอีเมลหรือชื่อ…" className="field py-3 pl-10" />
        {list.isFetching && <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-subtle" aria-label="กำลังค้นหา" />}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="สิทธิ์">
          {chip(null, role, setRoleFilter, 'ทุกสิทธิ์')}
          {chip<Role | null>('user', role, setRoleFilter, 'ผู้ใช้')}
          {chip<Role | null>('admin', role, setRoleFilter, 'ผู้ดูแล')}
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="สถานะ">
          {chip(null, status, setStatus, 'ทุกสถานะ')}
          {chip<'active' | 'suspended' | null>('active', status, setStatus, 'ใช้งานได้')}
          {chip<'active' | 'suspended' | null>('suspended', status, setStatus, 'ถูกระงับ')}
        </div>
      </div>

      <Card as="div" className="p-0">
        {list.isPending ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !list.data?.users.length ? (
          <EmptyState title="ไม่พบผู้ใช้" description="ลองเปลี่ยนคำค้นหรือตัวกรอง" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">ผู้ใช้</th>
                  <th scope="col" className="px-3 py-3 font-medium">สิทธิ์</th>
                  <th scope="col" className="px-3 py-3 font-medium">สถานะ</th>
                  <th scope="col" className="px-3 py-3 font-medium">สมัครเมื่อ</th>
                  <th scope="col" className="px-3 py-3 font-medium">ใช้งานล่าสุด</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.data.users.map((u) => {
                  const self = u.id === me;
                  return (
                    <tr key={u.id} className={u.isSuspended ? 'opacity-60' : ''}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar url={u.avatarUrl} name={u.displayName || u.email} size={34} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {u.displayName || '—'} {self && <span className="text-xs text-accent-soft">(คุณ)</span>}
                            </p>
                            <p className="truncate text-xs text-subtle">
                              {u.email} · {u.provider === 'google' ? 'Google' : 'อีเมล'}
                              {!u.emailConfirmed && <span className="text-warn"> · ยังไม่ยืนยันอีเมล</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.role === 'admin' ? 'bg-accent/15 text-accent-soft' : 'bg-fg/5 text-muted'}`}>{u.role === 'admin' ? 'ผู้ดูแล' : 'ผู้ใช้'}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.isSuspended ? 'bg-expense/15 text-expense' : 'bg-income/15 text-income'}`}>{u.isSuspended ? 'ถูกระงับ' : 'ใช้งานได้'}</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted">{formatDate(u.createdAt.slice(0, 10), era, 'short')}</td>
                      <td className="px-3 py-3 text-xs text-muted">{relative(u.lastSeenAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={self || busy !== null}
                            onClick={() => void act(u, 'role')}
                            className="btn-ghost px-2.5 py-1.5 text-xs"
                            title={self ? 'เปลี่ยนสิทธิ์ของตัวเองไม่ได้' : undefined}
                            aria-label={u.role === 'admin' ? `ถอดสิทธิ์ผู้ดูแลของ ${u.email}` : `ตั้ง ${u.email} เป็นผู้ดูแล`}
                          >
                            {busy === u.id + 'role' ? <Loader2 size={14} className="animate-spin" /> : u.role === 'admin' ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                            {u.role === 'admin' ? 'ถอดสิทธิ์' : 'ตั้งเป็นผู้ดูแล'}
                          </button>
                          <button
                            type="button"
                            disabled={self || busy !== null}
                            onClick={() => void act(u, 'suspend')}
                            className={`btn px-2.5 py-1.5 text-xs ${u.isSuspended ? 'text-income hover:bg-income/10' : 'text-expense hover:bg-expense/10'}`}
                            aria-label={u.isSuspended ? `เปิดใช้งาน ${u.email}` : `ระงับ ${u.email}`}
                          >
                            {busy === u.id + 'suspend' ? <Loader2 size={14} className="animate-spin" /> : u.isSuspended ? <UserCheck size={14} /> : <UserX size={14} />}
                            {u.isSuspended ? 'เปิดใช้งาน' : 'ระงับ'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="เปลี่ยนหน้า">
          <button type="button" className="btn-outline px-3" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="หน้าก่อนหน้า">
            <ChevronLeft size={16} />
          </button>
          <span className="num text-sm text-muted">
            หน้า {page + 1} / {pages}
          </span>
          <button type="button" className="btn-outline px-3" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} aria-label="หน้าถัดไป">
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}
