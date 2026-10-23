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
