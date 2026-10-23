import { ChevronRight, Database, Eye, KeyRound, Moon, Palette, Plus, Sparkles, Sun, UserRound } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CategoryEditor } from '../components/settings/CategoryEditor';
import { PinSetup } from '../components/settings/PinSetup';
import { Card, PageHeader, Skeleton } from '../components/ui/Card';
import { CategoryIcon } from '../components/ui/CategoryIcon';
import { useCategories } from '../hooks/useData';
import { formatDate } from '../lib/format';
import { useSettings, type Currency, type MotionPref } from '../store/settings';
import type { Category, TxType } from '../types';

export function Row({ icon: Icon, title, desc, children }: { icon: typeof Sun; title: string; desc?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fg/5 text-muted" aria-hidden>
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {desc && <p className="text-xs text-subtle">{desc}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="inline-flex rounded-xl bg-fg/5 p-1" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${value === o.value ? 'bg-accent/20 text-fg' : 'text-muted hover:text-fg'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Settings() {
  const s = useSettings();
  const categories = useCategories();
  const [catTab, setCatTab] = useState<TxType>('expense');
  const [catEdit, setCatEdit] = useState<Category | null | 'new'>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const shown = (categories ?? []).filter((c) => c.type === catTab);

  return (
    <div className="space-y-6">
      <PageHeader title="ตั้งค่า" />

      <Link to="/app/account" className="glass flex items-center gap-3 rounded-2xl p-4 transition hover:bg-fg/[0.06]">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent-soft" aria-hidden>
          <UserRound size={18} />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-medium">บัญชีและข้อมูล</span>
          <span className="block text-xs text-subtle">โปรไฟล์ รหัสผ่าน สำรอง/นำเข้าข้อมูล ลบบัญชี</span>
        </span>
        <ChevronRight size={18} className="text-subtle" aria-hidden />
      </Link>

      <Card title="การแสดงผล">
        <div className="divide-y divide-line">
          <Row icon={s.theme === 'dark' ? Moon : Sun} title="ธีม" desc="คีย์ลัด D · บันทึกในบัญชี ใช้ได้ทุกอุปกรณ์">
            <Segmented label="ธีม" value={s.theme} onChange={s.setTheme} options={[{ value: 'dark', label: 'มืด' }, { value: 'light', label: 'สว่าง' }]} />
          </Row>
          <Row icon={Palette} title="ปีที่แสดง" desc={`ตัวอย่าง: ${formatDate(new Date(), s.era, 'long')}`}>
            <Segmented label="ศักราช" value={s.era} onChange={s.setEra} options={[{ value: 'BE', label: 'พ.ศ.' }, { value: 'CE', label: 'ค.ศ.' }]} />
          </Row>
          <Row icon={Database} title="สกุลเงิน" desc="ใช้สำหรับการแสดงผลเท่านั้น ไม่มีการแปลงค่า">
            <label className="sr-only" htmlFor="currency">
              สกุลเงิน
            </label>
            <select id="currency" value={s.currency} onChange={(e) => s.setCurrency(e.target.value as Currency)} className="field w-auto py-1.5 text-xs">
              <option value="THB">฿ บาท (THB)</option>
              <option value="USD">$ ดอลลาร์ (USD)</option>
              <option value="EUR">€ ยูโร (EUR)</option>
              <option value="JPY">¥ เยน (JPY)</option>
            </select>
          </Row>
          <Row icon={Sparkles} title="ภาพเคลื่อนไหว & 3D" desc="ปิดเพื่อประหยัดแบตหรือลดการเคลื่อนไหว (เฉพาะเครื่องนี้)">
            <Segmented<MotionPref> label="ภาพเคลื่อนไหว" value={s.motion} onChange={s.setMotion} options={[{ value: 'system', label: 'ตามระบบ' }, { value: 'full', label: 'เปิด' }, { value: 'reduce', label: 'ลด' }]} />
          </Row>
        </div>
      </Card>

      <Card title="ความเป็นส่วนตัว (เฉพาะเครื่องนี้)">
        <div className="divide-y divide-line">
          <Row icon={Eye} title="ซ่อนตัวเลข (Privacy mode)" desc="แสดงยอดเงินเป็น ****">
            <label className="relative inline-flex cursor-pointer items-center">
              <input type="checkbox" className="peer sr-only" checked={s.privacy} onChange={s.togglePrivacy} aria-label="ซ่อนตัวเลข" />
              <span className="h-6 w-10 rounded-full bg-fg/15 transition after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:bg-accent peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-accent-soft" />
            </label>
          </Row>
          <Row icon={KeyRound} title="รหัส PIN ล็อกหน้าจอ" desc={s.pinHash ? 'เปิดใช้งานอยู่บนเครื่องนี้' : 'ไม่ได้ตั้ง (ไม่บังคับ)'}>
            <button type="button" className="btn-outline py-1.5 text-xs" onClick={() => setPinOpen(true)}>
              {s.pinHash ? 'เปลี่ยน / ปิด' : 'ตั้ง PIN'}
            </button>
          </Row>
        </div>
      </Card>

      <Card
        title="หมวดหมู่"
        action={
          <button type="button" className="btn-outline py-1.5 text-xs" onClick={() => setCatEdit('new')}>
            <Plus size={14} /> เพิ่ม
          </button>
        }
      >
        <Segmented label="ประเภทหมวดหมู่" value={catTab} onChange={setCatTab} options={[{ value: 'expense', label: 'รายจ่าย' }, { value: 'income', label: 'รายรับ' }]} />
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {categories === undefined
            ? Array.from({ length: 6 }, (_, i) => (
                <li key={i}>
                  <Skeleton className="h-12" />
                </li>
              ))
            : shown.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setCatEdit(c)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-fg/5" aria-label={`แก้ไขหมวด ${c.name}`}>
                    <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                    <span className="flex-1 text-sm">{c.name}</span>
                    <span className="text-[11px] text-subtle">{c.keywords.length} คำค้น</span>
                  </button>
                </li>
              ))}
        </ul>
      </Card>

      <p className="pb-4 text-center text-xs text-subtle">Coinly v2.0 · ข้อมูลซิงก์ผ่าน Supabase และแยกตามบัญชีผู้ใช้</p>

      <CategoryEditor open={catEdit !== null} onClose={() => setCatEdit(null)} category={catEdit === 'new' ? null : catEdit} defaultType={catTab} count={categories?.length ?? 0} />
      <PinSetup open={pinOpen} onClose={() => setPinOpen(false)} />
    </div>
  );
}
