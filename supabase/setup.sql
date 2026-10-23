-- =====================================================================
-- Coinly · setup.sql — รวม migration ทั้งหมด (สร้างจากโฟลเดอร์ migrations/)
-- วางทั้งไฟล์ใน Supabase Dashboard → SQL Editor แล้วกด Run (รันซ้ำได้)
-- =====================================================================


-- >>>>>>>>>> migrations/20261023000100_tables.sql
-- =====================================================================
-- Coinly · 0001 ตารางหลัก + index + trigger updated_at
-- รันตามลำดับไฟล์ หรือรัน supabase/setup.sql (รวมทุกไฟล์ไว้แล้ว) ใน SQL Editor
-- รันซ้ำได้ (idempotent)
-- =====================================================================

-- schema สำหรับฟังก์ชันภายใน (ไม่ถูกเปิดเป็น API ผ่าน PostgREST)
create schema if not exists private;
alter default privileges in schema private revoke execute on functions from public;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- profiles: ข้อมูลผู้ใช้ 1:1 กับ auth.users ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  avatar_url text check (avatar_url is null or (char_length(avatar_url) <= 500 and avatar_url ~ '^https?://')),
  currency text not null default 'THB' check (currency in ('THB', 'USD', 'EUR', 'JPY')),
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  use_buddhist_year boolean not null default true,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_suspended boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- categories ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  type text not null check (type in ('income', 'expense')),
  icon text not null default 'tag' check (icon ~ '^[a-z0-9-]{1,32}$'),
  color text not null default '#94A3B8' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  -- คำที่ใช้จับคู่ตอนพิมพ์เร็ว เช่น "กาแฟ" → อาหาร
  keywords text[] not null default '{}'
    check (cardinality(keywords) <= 50 and char_length(array_to_string(keywords, ',')) <= 1000),
  sort_order integer not null default 0,
  -- หมวดสำรอง ("อื่น ๆ") ที่ลบไม่ได้ ใช้รับรายการเมื่อหมวดอื่นถูกลบ
  system_key text check (system_key in ('other_expense', 'other_income')),
  created_at timestamptz not null default now(),
  constraint categories_id_user_key unique (id, user_id),
  constraint categories_user_type_name_key unique (user_id, type, name),
  constraint categories_user_system_key unique (user_id, system_key)
);

-- ---------- recurring_rules: รายการซ้ำ ----------
create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null check (amount > 0),
  category_id uuid not null,
  note text not null default '' check (char_length(note) <= 200),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'card', 'transfer', 'qr', 'ewallet')),
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  start_date date not null check (start_date between '2000-01-01' and '2100-12-31'),
  -- จำนวนครั้งที่สร้างไปแล้ว: next_run_date = start_date + (occurrences × ความถี่) เสมอ
  occurrences integer not null default 0 check (occurrences >= 0),
  next_run_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_rules_id_user_key unique (id, user_id),
  constraint recurring_rules_next_after_start check (next_run_date >= start_date),
  -- composite FK: บังคับว่าหมวดต้องเป็นของผู้ใช้คนเดียวกัน (FK ไม่ผ่าน RLS)
  constraint recurring_rules_category_fk foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete cascade
);

-- ---------- transactions ----------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null check (amount > 0),
  category_id uuid not null,
  date date not null check (date between '2000-01-01' and '2100-12-31'),
  note text not null default '' check (char_length(note) <= 200),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'card', 'transfer', 'qr', 'ewallet')),
  recurring_rule_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_category_fk foreign key (category_id, user_id)
    references public.categories (id, user_id),
  constraint transactions_recurring_fk foreign key (recurring_rule_id, user_id)
    references public.recurring_rules (id, user_id) on delete set null (recurring_rule_id)
);

-- ---------- budgets: category_id null = งบรวม, month = วันที่ 1 ของเดือน ----------
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid,
  -- 0 = ยกเลิกงบตั้งแต่เดือนนี้เป็นต้นไป (งบจะใช้ต่อเนื่องไปเดือนถัดไปจนกว่าจะแก้)
  amount numeric(12, 2) not null check (amount >= 0),
  month date not null check (extract(day from month) = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_category_fk foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete cascade,
  constraint budgets_unique_month unique nulls not distinct (user_id, month, category_id)
);

-- ---------- goals: เป้าหมายการออม ----------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  target_amount numeric(12, 2) not null check (target_amount > 0),
  current_amount numeric(12, 2) not null default 0 check (current_amount >= 0),
  deadline date check (deadline between '2000-01-01' and '2100-12-31'),
  icon text not null default 'piggy' check (icon ~ '^[a-z0-9-]{1,32}$'),
  color text not null default '#8B5CF6' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- index ----------
create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc, created_at desc);
create index if not exists transactions_user_category_idx on public.transactions (user_id, category_id);
create index if not exists transactions_recurring_idx on public.transactions (recurring_rule_id) where recurring_rule_id is not null;
create index if not exists transactions_created_at_idx on public.transactions (created_at);
create index if not exists categories_user_type_idx on public.categories (user_id, type, sort_order);
create index if not exists budgets_user_month_idx on public.budgets (user_id, month desc);
create index if not exists goals_user_idx on public.goals (user_id, created_at);
create index if not exists recurring_user_next_idx on public.recurring_rules (user_id, next_run_date) where active;
create index if not exists profiles_created_at_idx on public.profiles (created_at);
create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at);

-- ---------- trigger updated_at ----------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'transactions', 'budgets', 'goals', 'recurring_rules'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t);
  end loop;
end $$;

-- >>>>>>>>>> migrations/20261023000200_security.sql
-- =====================================================================
-- Coinly · 0002 สิทธิ์ (grants) + Row Level Security
-- หลักการ: ผู้ใช้อ่าน/เขียนได้เฉพาะแถวที่ user_id = auth.uid() และบัญชีไม่ถูกระงับ
-- admin ไม่มี policy อ่านข้อมูลการเงินของผู้อื่น (เห็นแค่สถิติรวมผ่านฟังก์ชัน admin_*)
-- =====================================================================

-- ผู้ใช้ปัจจุบันยังใช้งานได้ (ไม่ถูกระงับ) — security definer เพื่อไม่ติด RLS ของ profiles เอง
create or replace function private.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select not p.is_suspended from public.profiles p where p.id = auth.uid()), false)
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role = 'admin' and not p.is_suspended from public.profiles p where p.id = auth.uid()), false)
$$;

-- escape อักขระพิเศษของ LIKE (% _ \) จากคำค้นของผู้ใช้
create or replace function private.escape_like(p text)
returns text language sql immutable set search_path = '' as $$
  select replace(replace(replace(coalesce(p, ''), '\', '\\'), '%', '\%'), '_', '\_')
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_active_user(), private.is_admin(), private.escape_like(text) to authenticated;

-- ---------- table grants ----------
-- anon (ยังไม่ล็อกอิน) ไม่มีสิทธิ์ใด ๆ ในข้อมูลแอป
revoke all on public.profiles, public.categories, public.transactions,
  public.budgets, public.goals, public.recurring_rules from anon;

-- profiles: สร้างโดย trigger เท่านั้น และแก้ได้เฉพาะคอลัมน์ส่วนตัว (ห้ามแก้ role / is_suspended เอง)
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, currency, theme, use_buddhist_year) on public.profiles to authenticated;

-- ตารางข้อมูลการเงิน: จำกัดคอลัมน์ที่ insert/update ได้ (คอลัมน์ระบบตั้งโดย default/trigger/ฟังก์ชัน)
revoke insert, update on public.categories, public.transactions, public.budgets,
  public.goals, public.recurring_rules from authenticated;
grant select, delete on public.categories, public.transactions, public.budgets,
  public.goals, public.recurring_rules to authenticated;

grant insert (id, name, type, icon, color, keywords, sort_order) on public.categories to authenticated;
grant update (name, icon, color, keywords, sort_order) on public.categories to authenticated;

-- recurring_rule_id ใส่ได้ (ใช้ตอนกด Undo หลังลบ) — composite FK บังคับว่าต้องเป็นกฎของผู้ใช้เอง
grant insert (id, type, amount, category_id, date, note, payment_method, recurring_rule_id) on public.transactions to authenticated;
grant update (type, amount, category_id, date, note, payment_method) on public.transactions to authenticated;

grant insert (category_id, amount, month) on public.budgets to authenticated;
grant update (amount) on public.budgets to authenticated;

grant insert (id, name, target_amount, current_amount, deadline, icon, color) on public.goals to authenticated;
grant update (name, target_amount, current_amount, deadline, icon, color) on public.goals to authenticated;

grant insert (id, type, amount, category_id, note, payment_method, frequency, start_date) on public.recurring_rules to authenticated;
grant update (amount, note, category_id, payment_method, active) on public.recurring_rules to authenticated;

-- รายการซ้ำใหม่: ครั้งแรกคือ start_date เสมอ (ผู้ใช้ตั้ง occurrences/next_run_date เองไม่ได้)
create or replace function private.init_recurring_rule()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.next_run_date := coalesce(new.next_run_date, new.start_date);
  return new;
end $$;
drop trigger if exists init_recurring_rule on public.recurring_rules;
create trigger init_recurring_rule before insert on public.recurring_rules
  for each row execute function private.init_recurring_rule();

-- ---------- RLS ----------
alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select private.is_active_user()))
  with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['categories', 'transactions', 'budgets', 'goals', 'recurring_rules'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format($p$create policy %I on public.%I for select to authenticated
      using (user_id = (select auth.uid()) and (select private.is_active_user()))$p$, t || '_select_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format($p$create policy %I on public.%I for insert to authenticated
      with check (user_id = (select auth.uid()) and (select private.is_active_user()))$p$, t || '_insert_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format($p$create policy %I on public.%I for update to authenticated
      using (user_id = (select auth.uid()) and (select private.is_active_user()))
      with check (user_id = (select auth.uid()))$p$, t || '_update_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format($p$create policy %I on public.%I for delete to authenticated
      using (user_id = (select auth.uid()) and (select private.is_active_user()))$p$, t || '_delete_own', t);
  end loop;
end $$;

-- หมวดสำรอง ("อื่น ๆ") ลบไม่ได้
drop policy if exists categories_delete_own on public.categories;
create policy categories_delete_own on public.categories for delete to authenticated
  using (user_id = (select auth.uid()) and system_key is null and (select private.is_active_user()));

-- >>>>>>>>>> migrations/20261023000300_functions.sql
-- =====================================================================
-- Coinly · 0003 ฟังก์ชัน: สมัครสมาชิก, รายการซ้ำ, งบ, เป้าหมาย, สรุปยอด, import/clear
-- ทุกฟังก์ชันตั้ง search_path = '' และอ้างชื่อเต็ม (schema.table) เพื่อความปลอดภัย
-- ฟังก์ชัน security definer ทุกตัวกรองด้วย auth.uid() เองเสมอ
-- =====================================================================

-- ---------- helper ----------
create or replace function private.nth_occurrence(p_start date, p_frequency text, p_n integer)
returns date language sql immutable set search_path = '' as $$
  -- คำนวณจากวันเริ่มเสมอ เพื่อไม่ให้วันเลื่อน (31 ม.ค. → 28 ก.พ. → 31 มี.ค.)
  select case p_frequency
    when 'daily' then p_start + p_n
    when 'weekly' then p_start + p_n * 7
    else (p_start + make_interval(months => p_n))::date
  end
$$;

create or replace function private.try_date(p text)
returns date language plpgsql immutable set search_path = '' as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return case when p::date between '2000-01-01' and '2100-12-31' then p::date end;
exception when others then
  return null;
end $$;

create or replace function private.try_amount(p text)
returns numeric language sql immutable set search_path = '' as $$
  select case
    when p ~ '^\d{1,10}(\.\d+)?$' and round(p::numeric, 2) between 0.01 and 9999999999.99 then round(p::numeric, 2)
  end
$$;

create or replace function private.require_active_user()
returns uuid language plpgsql stable set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not private.is_active_user() then
    raise exception 'ไม่ได้รับอนุญาต' using errcode = '42501';
  end if;
  return uid;
end $$;

-- ---------- หมวดหมู่เริ่มต้น (สร้างตอนสมัคร และตอนล้างข้อมูล) ----------
create or replace function private.seed_default_categories(p_user uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.categories (user_id, name, type, icon, color, sort_order, system_key, keywords)
  values
    (p_user, 'อาหาร', 'expense', 'utensils', '#F59E0B', 0, null, array['อาหาร','ข้าว','กาแฟ','ชา','น้ำ','ขนม','ก๋วยเตี๋ยว','ส้มตำ','หมูกระทะ','ชาบู','บุฟเฟ่ต์','มื้อ','กิน','เครื่องดื่ม','pizza','coffee','food','starbucks','kfc','mk','grabfood','lineman','ชานม','บิงซู']),
    (p_user, 'เดินทาง', 'expense', 'car', '#3B82F6', 1, null, array['เดินทาง','รถ','แท็กซี่','taxi','grab','bolt','bts','mrt','รถไฟ','น้ำมัน','ทางด่วน','ที่จอด','วิน','มอไซค์','เรือ','ตั๋ว','bus','รถเมล์']),
    (p_user, 'ช้อปปิ้ง', 'expense', 'shopping', '#EC4899', 2, null, array['ช้อป','ซื้อ','เสื้อ','กางเกง','รองเท้า','กระเป๋า','shopee','lazada','ของใช้','7-11','เซเว่น','lotus','big c','ห้าง','สกินแคร์','เครื่องสำอาง']),
    (p_user, 'บิล/ค่าน้ำไฟ', 'expense', 'receipt', '#06B6D4', 3, null, array['บิล','ค่าไฟ','ค่าน้ำ','ไฟฟ้า','ประปา','เน็ต','อินเทอร์เน็ต','โทรศัพท์','ค่าโทร','ค่าเช่า','เช่า','ค่าห้อง','คอนโด','ส่วนกลาง','ประกัน','ais','true','dtac']),
    (p_user, 'บันเทิง', 'expense', 'film', '#8B5CF6', 4, null, array['บันเทิง','หนัง','ดูหนัง','netflix','spotify','youtube','disney','เกม','game','steam','คอนเสิร์ต','ปาร์ตี้','เหล้า','เบียร์','คาราโอเกะ','เที่ยว']),
    (p_user, 'สุขภาพ', 'expense', 'health', '#10B981', 5, null, array['สุขภาพ','ยา','หมอ','โรงพยาบาล','คลินิก','ฟิตเนส','ยิม','gym','วิตามิน','ทำฟัน','นวด','ตรวจ']),
    (p_user, 'อื่น ๆ', 'expense', 'tag', '#94A3B8', 6, 'other_expense', '{}'),
    (p_user, 'เงินเดือน', 'income', 'briefcase', '#34D399', 7, null, array['เงินเดือน','salary','โบนัส','bonus','ค่าแรง']),
    (p_user, 'ฟรีแลนซ์', 'income', 'laptop', '#22D3EE', 8, null, array['ฟรีแลนซ์','freelance','งานนอก','รับจ้าง','โปรเจกต์','project','ค่าจ้าง','ขายของ']),
    (p_user, 'ลงทุน', 'income', 'trending', '#A3E635', 9, null, array['ลงทุน','ปันผล','ดอกเบี้ย','หุ้น','กองทุน','คริปโต','crypto','dividend']),
    (p_user, 'รายรับอื่น ๆ', 'income', 'coins', '#FBBF24', 10, 'other_income', array['คืนเงิน','refund','ของขวัญ','อั่งเปา','ได้เงิน','ขาย'])
  on conflict do nothing
$$;

-- ---------- trigger: ผู้ใช้สมัครใหม่ → สร้าง profile + หมวดหมู่เริ่มต้น ----------
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  avatar text := coalesce(meta ->> 'avatar_url', meta ->> 'picture');
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(btrim(coalesce(nullif(meta ->> 'display_name', ''), nullif(meta ->> 'full_name', ''), nullif(meta ->> 'name', ''), split_part(coalesce(new.email, ''), '@', 1))), 60),
    case when avatar ~ '^https?://' and char_length(avatar) <= 500 then avatar end
  )
  on conflict (id) do nothing;
  perform private.seed_default_categories(new.id);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------- บันทึกเวลาใช้งานล่าสุด (สำหรับสถิติผู้ใช้ active) ----------
create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = '' as $$
  update public.profiles set last_seen_at = now()
  where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '10 minutes')
$$;

-- ---------- รายการซ้ำ ----------
-- สร้างรายการจริงจากกฎที่ถึงกำหนด (รวมวันที่ค้าง) — skip locked กันสร้างซ้ำเมื่อเปิดหลายเครื่องพร้อมกัน
create or replace function public.process_recurring(p_today date)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  -- ยอมให้วันที่ฝั่งเครื่องเร็วกว่า UTC ได้ 1 วัน (เขตเวลาไทย +7) แต่ห้ามสร้างล่วงหน้าไกลกว่านั้น
  lim date := least(p_today, (now() at time zone 'utc')::date + 1);
  r public.recurring_rules;
  n integer;
  d date;
  created integer := 0;
begin
  if uid is null or not private.is_active_user() then return 0; end if;
  for r in
    select * from public.recurring_rules
    where user_id = uid and active and next_run_date <= lim
    for update skip locked
  loop
    n := r.occurrences;
    d := r.next_run_date;
    while d <= lim and n - r.occurrences < 400 loop
      insert into public.transactions (user_id, type, amount, category_id, date, note, payment_method, recurring_rule_id)
      values (uid, r.type, r.amount, r.category_id, d, r.note, r.payment_method, r.id);
      n := n + 1;
      d := private.nth_occurrence(r.start_date, r.frequency, n);
      created := created + 1;
    end loop;
    update public.recurring_rules set occurrences = n, next_run_date = d where id = r.id;
  end loop;
  return created;
end $$;

-- สร้างกฎรายการซ้ำ + รายการครั้งแรก (ที่ start_date) + ตามเก็บรายการที่ผ่านมาแล้ว ในครั้งเดียว
create or replace function public.create_recurring_rule(
  p_type text, p_amount numeric, p_category_id uuid, p_date date,
  p_note text, p_payment_method text, p_frequency text, p_today date
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_active_user();
  rid uuid;
begin
  insert into public.recurring_rules (user_id, type, amount, category_id, note, payment_method, frequency, start_date, occurrences, next_run_date)
  values (uid, p_type, p_amount, p_category_id, left(coalesce(p_note, ''), 200), p_payment_method, p_frequency, p_date, 1,
          private.nth_occurrence(p_date, p_frequency, 1))
  returning id into rid;
  insert into public.transactions (user_id, type, amount, category_id, date, note, payment_method, recurring_rule_id)
  values (uid, p_type, p_amount, p_category_id, p_date, left(coalesce(p_note, ''), 200), p_payment_method, rid);
  perform public.process_recurring(p_today);
  return rid;
end $$;

-- ---------- หมวดหมู่ ----------
-- ลบหมวด: ย้ายรายการ/รายการซ้ำไปหมวด "อื่น ๆ" ของประเภทเดียวกันก่อน (security invoker → อยู่ภายใต้ RLS)
create or replace function public.delete_category(p_id uuid)
returns integer language plpgsql set search_path = '' as $$
declare
  c public.categories;
  fallback uuid;
  moved integer;
begin
  select * into c from public.categories where id = p_id;
  if not found then raise exception 'ไม่พบหมวดหมู่' using errcode = 'P0002'; end if;
  if c.system_key is not null then raise exception 'ลบหมวดสำรองไม่ได้' using errcode = '42501'; end if;
  select id into fallback from public.categories
  where user_id = c.user_id and system_key = case c.type when 'income' then 'other_income' else 'other_expense' end;
  update public.transactions set category_id = fallback where category_id = p_id;
  get diagnostics moved = row_count;
  update public.recurring_rules set category_id = fallback where category_id = p_id;
  delete from public.categories where id = p_id;
  return moved;
end $$;

-- ---------- งบประมาณ ----------
-- งบที่มีผลในเดือน p_month = แถวล่าสุดที่ month <= p_month ของแต่ละหมวด (amount 0 = ยกเลิก)
create or replace function public.get_budgets(p_month date)
returns table (category_id uuid, amount numeric, month date)
language sql stable set search_path = '' as $$
  select b.category_id, b.amount, b.month
  from (
    select distinct on (category_id) category_id, amount, month
    from public.budgets
    where month <= date_trunc('month', p_month)::date
    order by category_id, month desc
  ) b
  where b.amount > 0
$$;

-- ตั้งงบหลายหมวดพร้อมกันสำหรับเดือนนี้เป็นต้นไป: p_items = [{ "category_id": uuid|null, "amount": number|null }]
create or replace function public.set_budgets(p_month date, p_items jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_active_user();
  m date := date_trunc('month', p_month)::date;
  item jsonb;
  cid uuid;
  amt numeric;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'ข้อมูลงบไม่ถูกต้อง' using errcode = '22023';
  end if;
  for item in select * from jsonb_array_elements(p_items) loop
    cid := nullif(item ->> 'category_id', '')::uuid;
    amt := coalesce(private.try_amount(item ->> 'amount'), 0);
    if cid is not null and not exists (select 1 from public.categories where id = cid and user_id = uid and type = 'expense') then
      raise exception 'หมวดหมู่ไม่ถูกต้อง' using errcode = '22023';
    end if;
    -- เดือนอนาคตที่ตั้งไว้ก่อนหน้าจะถูกแทนด้วยค่าใหม่นี้
    delete from public.budgets where user_id = uid and category_id is not distinct from cid and month > m;
    insert into public.budgets (user_id, category_id, amount, month) values (uid, cid, amt, m)
    on conflict (user_id, month, category_id) do update set amount = excluded.amount;
  end loop;
end $$;

-- ---------- เป้าหมาย: เพิ่ม/ถอนเงินออมแบบ atomic (กันค่าทับกันเมื่อแก้จากหลายเครื่อง) ----------
drop function if exists public.apply_goal_delta(uuid, numeric);
create or replace function public.apply_goal_delta(p_goal_id uuid, p_delta numeric)
returns setof public.goals language sql set search_path = '' as $$
  update public.goals
  set current_amount = least(9999999999.99, greatest(0, current_amount + round(p_delta, 2)))
  where id = p_goal_id
  returning *
$$;

-- ---------- สรุปยอด (ลดภาระ frontend) ----------
create or replace view public.monthly_summary with (security_invoker = true) as
select
  user_id,
  date_trunc('month', date)::date as month,
  coalesce(sum(amount) filter (where type = 'income'), 0)::numeric(14, 2) as income,
  coalesce(sum(amount) filter (where type = 'expense'), 0)::numeric(14, 2) as expense,
  count(*) as tx_count
from public.transactions
group by user_id, date_trunc('month', date);

-- สรุปรายเดือน เติมเดือนที่ไม่มีรายการเป็น 0
create or replace function public.get_monthly_summary(p_from date, p_to date)
returns table (month date, income numeric, expense numeric, net numeric, tx_count bigint)
language sql stable set search_path = '' as $$
  with months as (
    select generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month')::date as month
  ),
  agg as (
    select date_trunc('month', t.date)::date as month,
      sum(t.amount) filter (where t.type = 'income') as income,
      sum(t.amount) filter (where t.type = 'expense') as expense,
      count(*) as tx_count
    from public.transactions t
    where t.user_id = auth.uid() and t.date >= date_trunc('month', p_from)::date
      and t.date < (date_trunc('month', p_to) + interval '1 month')::date
    group by 1
  )
  select m.month, coalesce(a.income, 0), coalesce(a.expense, 0),
    coalesce(a.income, 0) - coalesce(a.expense, 0), coalesce(a.tx_count, 0)
  from months m left join agg a using (month)
  order by m.month
$$;

-- ยอดรวมในช่วง (null = ไม่จำกัด) — ใช้คำนวณยอดคงเหลือสะสม
create or replace function public.get_totals(p_from date default null, p_to date default null)
returns table (income numeric, expense numeric, net numeric, tx_count bigint)
language sql stable set search_path = '' as $$
  select
    coalesce(sum(amount) filter (where type = 'income'), 0),
    coalesce(sum(amount) filter (where type = 'expense'), 0),
    coalesce(sum(case when type = 'income' then amount else -amount end), 0),
    count(*)
  from public.transactions
  where user_id = auth.uid()
    and (p_from is null or date >= p_from)
    and (p_to is null or date <= p_to)
$$;

-- ---------- ค้นหารายการ (หน้า Transactions) — security invoker ใช้ RLS ตามปกติ ----------
create or replace function private.filtered_transactions(
  p_query text, p_type text, p_categories uuid[], p_start date, p_end date, p_min numeric, p_max numeric
)
returns setof public.transactions language sql stable set search_path = '' as $$
  select t.* from public.transactions t
  where t.user_id = auth.uid()
    and (p_type is null or t.type = p_type)
    and (p_categories is null or cardinality(p_categories) = 0 or t.category_id = any (p_categories))
    and (p_start is null or t.date >= p_start)
    and (p_end is null or t.date <= p_end)
    and (p_min is null or t.amount >= p_min)
    and (p_max is null or t.amount <= p_max)
    and (
      coalesce(btrim(p_query), '') = ''
      or t.note ilike '%' || private.escape_like(left(btrim(p_query), 100)) || '%'
      or t.amount::text like private.escape_like(left(btrim(p_query), 100)) || '%'
      or exists (
        select 1 from public.categories c
        where c.id = t.category_id and c.name ilike '%' || private.escape_like(left(btrim(p_query), 100)) || '%'
      )
    )
$$;
grant execute on function private.filtered_transactions(text, text, uuid[], date, date, numeric, numeric) to authenticated;

create or replace function public.search_transactions(
  p_query text default null, p_type text default null, p_categories uuid[] default null,
  p_start date default null, p_end date default null, p_min numeric default null, p_max numeric default null,
  p_limit integer default 50, p_offset integer default 0
)
returns setof public.transactions language sql stable set search_path = '' as $$
  select * from private.filtered_transactions(p_query, p_type, p_categories, p_start, p_end, p_min, p_max)
  order by date desc, created_at desc, id
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)
$$;

create or replace function public.search_totals(
  p_query text default null, p_type text default null, p_categories uuid[] default null,
  p_start date default null, p_end date default null, p_min numeric default null, p_max numeric default null
)
returns table (income numeric, expense numeric, net numeric, tx_count bigint)
language sql stable set search_path = '' as $$
  select
    coalesce(sum(amount) filter (where type = 'income'), 0),
    coalesce(sum(amount) filter (where type = 'expense'), 0),
    coalesce(sum(case when type = 'income' then amount else -amount end), 0),
    count(*)
  from private.filtered_transactions(p_query, p_type, p_categories, p_start, p_end, p_min, p_max)
$$;

-- ---------- ล้างข้อมูลทั้งหมดของตัวเอง แล้วเริ่มใหม่ด้วยหมวดหมู่เริ่มต้น ----------
create or replace function private.wipe_user_data(p_user uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.transactions where user_id = p_user;
  delete from public.recurring_rules where user_id = p_user;
  delete from public.budgets where user_id = p_user;
  delete from public.goals where user_id = p_user;
  delete from public.categories where user_id = p_user;
$$;

create or replace function public.clear_my_data(p_confirm text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_active_user();
begin
  if p_confirm is distinct from 'ล้างข้อมูล' then
    raise exception 'ข้อความยืนยันไม่ถูกต้อง' using errcode = '22023';
  end if;
  perform private.wipe_user_data(uid);
  perform private.seed_default_categories(uid);
end $$;

-- >>>>>>>>>> migrations/20261023000400_import_admin.sql
-- =====================================================================
-- Coinly · 0004 นำเข้าข้อมูล + ฟังก์ชันหลังบ้าน (admin) + สิทธิ์เรียกใช้ฟังก์ชัน
-- =====================================================================

-- ---------- นำเข้าข้อมูล ----------
-- p_mode = 'append'  : เพิ่มต่อจากข้อมูลเดิม (CSV) — อ้างหมวดด้วย category_name ได้
-- p_mode = 'replace' : ลบข้อมูลเดิมทั้งหมดแล้วแทนที่ด้วยไฟล์สำรอง (JSON)
-- ทุกค่าถูกตรวจซ้ำในฐานข้อมูล แถวที่ไม่ถูกต้องจะถูกข้าม
create or replace function public.import_data(p_payload jsonb, p_mode text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_active_user();
  cat_map jsonb := '{}'::jsonb;
  rule_map jsonb := '{}'::jsonb;
  c jsonb;
  r jsonb;
  cid uuid;
  cname text;
  ctype text;
  fb_expense uuid;
  fb_income uuid;
  total integer;
  inserted integer := 0;
  new_cats integer := 0;
begin
  if p_mode not in ('append', 'replace') then raise exception 'โหมดนำเข้าไม่ถูกต้อง' using errcode = '22023'; end if;
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'รูปแบบไฟล์ไม่ถูกต้อง' using errcode = '22023'; end if;
  total := coalesce(jsonb_array_length(case when jsonb_typeof(p_payload -> 'transactions') = 'array' then p_payload -> 'transactions' end), 0);
  if total > 50000 then raise exception 'นำเข้าได้ครั้งละไม่เกิน 50,000 รายการ' using errcode = '22023'; end if;
  if coalesce(jsonb_array_length(case when jsonb_typeof(p_payload -> 'categories') = 'array' then p_payload -> 'categories' end), 0) > 500 then
    raise exception 'หมวดหมู่มากเกินไป' using errcode = '22023';
  end if;

  if p_mode = 'replace' then
    perform private.wipe_user_data(uid);
  end if;

  -- 1) หมวดหมู่: จับคู่กับของเดิมด้วย (type, name) หรือสร้างใหม่ — map id เก่า → id ใหม่
  for c in select * from jsonb_array_elements(case when jsonb_typeof(p_payload -> 'categories') = 'array' then p_payload -> 'categories' else '[]'::jsonb end) loop
    cname := left(btrim(coalesce(c ->> 'name', '')), 40);
    ctype := c ->> 'type';
    continue when cname = '' or ctype not in ('income', 'expense');
    select id into cid from public.categories where user_id = uid and type = ctype and name = cname;
    if cid is null then
      insert into public.categories (user_id, name, type, icon, color, keywords, sort_order, system_key)
      values (
        uid, cname, ctype,
        case when c ->> 'icon' ~ '^[a-z0-9-]{1,32}$' then c ->> 'icon' else 'tag' end,
        case when c ->> 'color' ~ '^#[0-9A-Fa-f]{6}$' then c ->> 'color' else '#94A3B8' end,
        coalesce((select array_agg(left(k, 40)) from (select jsonb_array_elements_text(c -> 'keywords') k
          where jsonb_typeof(c -> 'keywords') = 'array' limit 50) s), '{}'),
        coalesce(case when c ->> 'sort_order' ~ '^\d{1,4}$' then (c ->> 'sort_order')::int end, 100 + new_cats),
        case when c ->> 'system_key' in ('other_expense', 'other_income')
          and not exists (select 1 from public.categories where user_id = uid and system_key = c ->> 'system_key')
          then c ->> 'system_key' end
      )
      returning id into cid;
      new_cats := new_cats + 1;
    end if;
    if c ->> 'id' is not null then cat_map := cat_map || jsonb_build_object(c ->> 'id', cid); end if;
    cat_map := cat_map || jsonb_build_object('n:' || ctype || ':' || cname, cid);
  end loop;

  -- 2) หมวดที่อ้างด้วยชื่อ (จาก CSV) แต่ยังไม่มี → สร้างใหม่
  for ctype, cname in
    select distinct x.type, left(btrim(x.category_name), 40)
    from jsonb_to_recordset(case when jsonb_typeof(p_payload -> 'transactions') = 'array' then p_payload -> 'transactions' else '[]'::jsonb end)
      as x(type text, category_name text)
    where x.type in ('income', 'expense') and coalesce(btrim(x.category_name), '') <> ''
    limit 200
  loop
    continue when cat_map ? ('n:' || ctype || ':' || cname);
    select id into cid from public.categories where user_id = uid and type = ctype and name = cname;
    if cid is null then
      insert into public.categories (user_id, name, type, sort_order) values (uid, cname, ctype, 100 + new_cats) returning id into cid;
      new_cats := new_cats + 1;
    end if;
    cat_map := cat_map || jsonb_build_object('n:' || ctype || ':' || cname, cid);
  end loop;

  -- หมวดสำรองต้องมีเสมอ (ใช้กับแถวที่หาหมวดไม่เจอ)
  perform private.ensure_fallback_categories(uid);
  select id into fb_expense from public.categories where user_id = uid and system_key = 'other_expense';
  select id into fb_income from public.categories where user_id = uid and system_key = 'other_income';

  -- 3) รายการซ้ำ (เฉพาะ replace)
  if p_mode = 'replace' then
    for r in select * from jsonb_array_elements(case when jsonb_typeof(p_payload -> 'recurring_rules') = 'array' then p_payload -> 'recurring_rules' else '[]'::jsonb end) loop
      continue when r ->> 'type' not in ('income', 'expense') or r ->> 'frequency' not in ('daily', 'weekly', 'monthly')
        or private.try_amount(r ->> 'amount') is null or private.try_date(r ->> 'start_date') is null;
      insert into public.recurring_rules (user_id, type, amount, category_id, note, payment_method, frequency, start_date, occurrences, next_run_date, active)
      values (
        uid, r ->> 'type', private.try_amount(r ->> 'amount'),
        coalesce((cat_map ->> (r ->> 'category_id'))::uuid, case r ->> 'type' when 'income' then fb_income else fb_expense end),
        left(coalesce(r ->> 'note', ''), 200),
        case when r ->> 'payment_method' in ('cash', 'card', 'transfer', 'qr', 'ewallet') then r ->> 'payment_method' else 'cash' end,
        r ->> 'frequency', private.try_date(r ->> 'start_date'),
        greatest(0, least(100000, coalesce(case when r ->> 'occurrences' ~ '^\d{1,6}$' then (r ->> 'occurrences')::int end, 0))),
        greatest(private.try_date(r ->> 'start_date'), coalesce(private.try_date(r ->> 'next_run_date'), private.try_date(r ->> 'start_date'))),
        coalesce((r ->> 'active')::boolean, true)
      )
      returning id into cid;
      if r ->> 'id' is not null then rule_map := rule_map || jsonb_build_object(r ->> 'id', cid); end if;
    end loop;
  end if;

  -- 4) รายการ (set-based เพื่อความเร็ว)
  insert into public.transactions (user_id, type, amount, category_id, date, note, payment_method, recurring_rule_id)
  select
    uid, x.type, private.try_amount(x.amount),
    coalesce(
      (cat_map ->> x.category_id)::uuid,
      (cat_map ->> ('n:' || x.type || ':' || left(btrim(coalesce(x.category_name, '')), 40)))::uuid,
      case x.type when 'income' then fb_income else fb_expense end
    ),
    private.try_date(x.date),
    left(coalesce(x.note, ''), 200),
    case when x.payment_method in ('cash', 'card', 'transfer', 'qr', 'ewallet') then x.payment_method else 'cash' end,
    (rule_map ->> x.recurring_rule_id)::uuid
  from jsonb_to_recordset(case when jsonb_typeof(p_payload -> 'transactions') = 'array' then p_payload -> 'transactions' else '[]'::jsonb end)
    as x(type text, amount text, category_id text, category_name text, date text, note text, payment_method text, recurring_rule_id text)
  where x.type in ('income', 'expense') and private.try_amount(x.amount) is not null and private.try_date(x.date) is not null;
  get diagnostics inserted = row_count;

  -- 5) งบและเป้าหมาย (เฉพาะ replace)
  if p_mode = 'replace' then
    insert into public.budgets (user_id, category_id, amount, month)
    select distinct on (cat, m) uid, cat, amt, m
    from (
      select
        case when coalesce(b ->> 'category_id', '') = '' then null else (cat_map ->> (b ->> 'category_id'))::uuid end as cat,
        coalesce(private.try_amount(b ->> 'amount'), 0) as amt,
        date_trunc('month', private.try_date(b ->> 'month'))::date as m,
        coalesce(b ->> 'category_id', '') = '' as is_total
      from jsonb_array_elements(case when jsonb_typeof(p_payload -> 'budgets') = 'array' then p_payload -> 'budgets' else '[]'::jsonb end) b
    ) s
    where m is not null and (is_total or cat is not null)
      and (cat is null or exists (select 1 from public.categories where id = cat and type = 'expense'));

    insert into public.goals (user_id, name, target_amount, current_amount, deadline, icon, color)
    select uid, left(btrim(g ->> 'name'), 60), private.try_amount(g ->> 'target_amount'),
      least(9999999999.99, coalesce(private.try_amount(g ->> 'current_amount'), 0)),
      private.try_date(g ->> 'deadline'),
      case when g ->> 'icon' ~ '^[a-z0-9-]{1,32}$' then g ->> 'icon' else 'piggy' end,
      case when g ->> 'color' ~ '^#[0-9A-Fa-f]{6}$' then g ->> 'color' else '#8B5CF6' end
    from jsonb_array_elements(case when jsonb_typeof(p_payload -> 'goals') = 'array' then p_payload -> 'goals' else '[]'::jsonb end) g
    where coalesce(btrim(g ->> 'name'), '') <> '' and private.try_amount(g ->> 'target_amount') is not null
    limit 200;
  end if;

  return jsonb_build_object('transactions', inserted, 'skipped', total - inserted, 'categories', new_cats);
end $$;

-- สร้าง/กำหนดหมวดสำรองให้ครบ (ถ้ามีหมวดชื่อเดียวกันอยู่แล้ว ใช้หมวดนั้นเป็นหมวดสำรอง)
create or replace function private.ensure_fallback_categories(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  k text;
  t text;
  n text;
  i text;
  col text;
begin
  foreach k in array array['other_expense', 'other_income'] loop
    continue when exists (select 1 from public.categories where user_id = p_user and system_key = k);
    t := case k when 'other_income' then 'income' else 'expense' end;
    n := case k when 'other_income' then 'รายรับอื่น ๆ' else 'อื่น ๆ' end;
    i := case k when 'other_income' then 'coins' else 'tag' end;
    col := case k when 'other_income' then '#FBBF24' else '#94A3B8' end;
    update public.categories set system_key = k where user_id = p_user and type = t and name = n;
    if not found then
      insert into public.categories (user_id, name, type, icon, color, sort_order, system_key)
      values (p_user, n, t, i, col, 99, k);
    end if;
  end loop;
end $$;

-- ---------- หลังบ้าน: เห็นเฉพาะสถิติรวม ไม่มีฟังก์ชันใดคืนรายการเงินรายบุคคล ----------
create or replace function private.require_admin()
returns void language plpgsql stable set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'สำหรับผู้ดูแลระบบเท่านั้น' using errcode = '42501'; end if;
end $$;

create or replace function public.admin_overview()
returns table (
  total_users bigint, new_today bigint, new_this_month bigint, active_7d bigint, active_30d bigint,
  suspended_users bigint, admin_users bigint, total_transactions bigint, transactions_today bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles where created_at >= date_trunc('day', now())),
    (select count(*) from public.profiles where created_at >= date_trunc('month', now())),
    (select count(*) from public.profiles where last_seen_at >= now() - interval '7 days'),
    (select count(*) from public.profiles where last_seen_at >= now() - interval '30 days'),
    (select count(*) from public.profiles where is_suspended),
    (select count(*) from public.profiles where role = 'admin'),
    (select count(*) from public.transactions),
    (select count(*) from public.transactions where created_at >= date_trunc('day', now()));
end $$;

-- ผู้ใช้ใหม่และจำนวนรายการที่สร้างใหม่ทั้งระบบ รายวัน
create or replace function public.admin_daily_stats(p_days integer default 30)
returns table (day date, new_users bigint, new_transactions bigint)
language plpgsql stable security definer set search_path = '' as $$
declare d integer := least(greatest(coalesce(p_days, 30), 1), 366);
begin
  perform private.require_admin();
  return query
  with days as (
    select generate_series((now() at time zone 'utc')::date - (d - 1), (now() at time zone 'utc')::date, interval '1 day')::date as day
  )
  select days.day,
    (select count(*) from public.profiles p where (p.created_at at time zone 'utc')::date = days.day),
    (select count(*) from public.transactions t where (t.created_at at time zone 'utc')::date = days.day)
  from days order by days.day;
end $$;

-- ผู้ใช้ใหม่รายเดือน + จำนวนผู้ใช้สะสม
create or replace function public.admin_monthly_stats(p_months integer default 12)
returns table (month date, new_users bigint, total_users bigint, new_transactions bigint)
language plpgsql stable security definer set search_path = '' as $$
declare m integer := least(greatest(coalesce(p_months, 12), 1), 60);
begin
  perform private.require_admin();
  return query
  with months as (
    select generate_series(date_trunc('month', now()) - make_interval(months => m - 1), date_trunc('month', now()), interval '1 month') as month
  )
  select months.month::date,
    (select count(*) from public.profiles p where p.created_at >= months.month and p.created_at < months.month + interval '1 month'),
    (select count(*) from public.profiles p where p.created_at < months.month + interval '1 month'),
    (select count(*) from public.transactions t where t.created_at >= months.month and t.created_at < months.month + interval '1 month')
  from months order by months.month;
end $$;

-- รายชื่อผู้ใช้ (ไม่มีข้อมูลการเงินรายบุคคล)
create or replace function public.admin_list_users(
  p_query text default null, p_role text default null, p_status text default null,
  p_limit integer default 25, p_offset integer default 0
)
returns table (
  id uuid, email text, display_name text, avatar_url text, role text, is_suspended boolean,
  provider text, email_confirmed boolean, created_at timestamptz, last_seen_at timestamptz, total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
declare q text := '%' || private.escape_like(left(btrim(coalesce(p_query, '')), 100)) || '%';
begin
  perform private.require_admin();
  return query
  select p.id, u.email::text, p.display_name, p.avatar_url, p.role, p.is_suspended,
    coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
    u.email_confirmed_at is not null,
    p.created_at, p.last_seen_at,
    count(*) over ()
  from public.profiles p
  join auth.users u on u.id = p.id
  where (coalesce(btrim(p_query), '') = '' or u.email ilike q or p.display_name ilike q)
    and (p_role is null or p.role = p_role)
    and (p_status is null or (p_status = 'suspended') = p.is_suspended)
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end $$;

-- ---------- สิทธิ์เรียกใช้ฟังก์ชัน ----------
-- Supabase ให้ anon เรียกฟังก์ชันใหม่ใน public ได้โดยอัตโนมัติ — ปิดก่อนแล้วเปิดให้เฉพาะผู้ที่ล็อกอิน
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'touch_last_seen', 'process_recurring', 'create_recurring_rule', 'delete_category', 'get_budgets',
      'set_budgets', 'apply_goal_delta', 'get_monthly_summary', 'get_totals', 'search_transactions',
      'search_totals', 'clear_my_data', 'import_data', 'admin_overview', 'admin_daily_stats',
      'admin_monthly_stats', 'admin_list_users'
    )
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

grant select on public.monthly_summary to authenticated;
revoke all on public.monthly_summary from anon;

-- >>>>>>>>>> migrations/20261023000500_storage_realtime.sql
-- =====================================================================
-- Coinly · 0005 Storage (รูปโปรไฟล์) + Realtime (ซิงก์ข้ามอุปกรณ์)
-- =====================================================================

-- ---------- Storage: bucket avatars ----------
-- อ่านได้สาธารณะ (ใช้แสดงรูป) แต่เขียน/ลบได้เฉพาะโฟลเดอร์ของตัวเอง: avatars/<user_id>/<file>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ต้องมี select เพื่อให้ upsert/ลบไฟล์ของตัวเองได้ (การแสดงรูปใช้ public URL ไม่ผ่าน policy นี้)
drop policy if exists avatars_select_own on storage.objects;
create policy avatars_select_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------- Realtime: แจ้งเตือนการเปลี่ยนแปลงไปยัง private channel ของเจ้าของข้อมูล ----------
-- ส่งเฉพาะ "ตารางไหนเปลี่ยน" (ไม่ส่งข้อมูลทั้งแถว) แล้วให้ client ดึงข้อมูลใหม่เองผ่าน RLS
-- statement-level trigger: import 1,000 รายการ = ส่ง 1 ข้อความ ไม่ใช่ 1,000
create or replace function private.broadcast_user_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if TG_OP = 'DELETE' then
    for uid in select distinct user_id from old_rows loop
      perform realtime.send(jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP), 'change', 'user:' || uid::text, true);
    end loop;
  else
    for uid in select distinct user_id from new_rows loop
      perform realtime.send(jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP), 'change', 'user:' || uid::text, true);
    end loop;
  end if;
  return null;
exception when others then
  -- realtime ล่มต้องไม่ทำให้การบันทึกข้อมูลล้มเหลว
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['categories', 'transactions', 'budgets', 'goals', 'recurring_rules'] loop
    execute format('drop trigger if exists broadcast_insert on public.%I', t);
    execute format('drop trigger if exists broadcast_update on public.%I', t);
    execute format('drop trigger if exists broadcast_delete on public.%I', t);
    execute format('create trigger broadcast_insert after insert on public.%I referencing new table as new_rows for each statement execute function private.broadcast_user_change()', t);
    execute format('create trigger broadcast_update after update on public.%I referencing new table as new_rows for each statement execute function private.broadcast_user_change()', t);
    execute format('create trigger broadcast_delete after delete on public.%I referencing old table as old_rows for each statement execute function private.broadcast_user_change()', t);
  end loop;
end $$;

-- profile เปลี่ยน (ชื่อ, ธีม, ถูกระงับ, เปลี่ยน role) → แจ้งเจ้าของ
create or replace function private.broadcast_profile_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(jsonb_build_object('table', 'profiles', 'op', TG_OP), 'change', 'user:' || new.id::text, true);
  return null;
exception when others then
  return null;
end $$;

drop trigger if exists broadcast_update on public.profiles;
create trigger broadcast_update after update on public.profiles
  for each row
  when (row(old.display_name, old.avatar_url, old.currency, old.theme, old.use_buddhist_year, old.role, old.is_suspended)
    is distinct from row(new.display_name, new.avatar_url, new.currency, new.theme, new.use_buddhist_year, new.role, new.is_suspended))
  execute function private.broadcast_profile_change();

-- อนุญาตให้ผู้ใช้ฟังได้เฉพาะ channel "user:<id ของตัวเอง>"
drop policy if exists coinly_user_channel_read on realtime.messages;
create policy coinly_user_channel_read on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'user:' || (select auth.uid())::text
  );
