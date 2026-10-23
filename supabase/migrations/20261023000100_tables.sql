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
