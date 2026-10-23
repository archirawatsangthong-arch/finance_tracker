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
