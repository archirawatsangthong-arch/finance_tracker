-- ตั้งบัญชีของคุณเป็นผู้ดูแลระบบคนแรก
-- 1) สมัครสมาชิกในแอปและยืนยันอีเมลให้เรียบร้อยก่อน
-- 2) แก้อีเมลด้านล่างเป็นของคุณ แล้วรันใน Supabase SQL Editor (รันในฐานะ postgres จึงข้ามข้อจำกัดสิทธิ์คอลัมน์ได้)
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'your-email@example.com');

-- ตรวจสอบผลลัพธ์ (ต้องเห็น 1 แถว role = admin)
select p.id, u.email, p.role from public.profiles p join auth.users u on u.id = p.id where p.role = 'admin';
