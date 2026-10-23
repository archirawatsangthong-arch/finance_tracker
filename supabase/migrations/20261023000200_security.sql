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
