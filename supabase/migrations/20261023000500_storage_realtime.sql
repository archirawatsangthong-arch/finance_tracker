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
