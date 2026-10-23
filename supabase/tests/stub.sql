-- จำลองโครงสร้างพื้นฐานของ Supabase ให้พอสำหรับทดสอบ migration บน PGlite (ไม่ใช้กับโปรเจกต์จริง)
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb,
  raw_app_meta_data jsonb,
  email_confirmed_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;

create schema storage;
grant usage on schema storage to authenticated;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:cardinality(string_to_array(name, '/')) - 1]
$$;
grant execute on function storage.foldername(text) to authenticated;

create schema realtime;
grant usage on schema realtime to authenticated;
create table realtime.messages (topic text, extension text, payload jsonb, event text, private boolean);
alter table realtime.messages enable row level security;
grant select on realtime.messages to authenticated;
create table realtime.sent (payload jsonb, event text, topic text, private boolean);
create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language sql security definer as $$
  insert into realtime.sent values (payload, event, topic, private)
$$;
create function realtime.topic() returns text language sql stable as $$
  select current_setting('realtime.topic', true)
$$;
grant execute on function realtime.topic() to authenticated;
