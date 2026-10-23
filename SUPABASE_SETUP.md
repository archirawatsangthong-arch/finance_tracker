# ตั้งค่า Supabase + Deploy

ทำตามลำดับนี้ครั้งเดียว ใช้เวลาประมาณ 15–20 นาที

## 1. สร้างโปรเจกต์
1. เข้า [supabase.com/dashboard](https://supabase.com/dashboard) → **New project** ตั้งชื่อ เลือก Region `Southeast Asia (Singapore)`
2. เมื่อสร้างเสร็จ ไปที่ **Project Settings → API Keys** คัดลอก
   - Project URL → `VITE_SUPABASE_URL`
   - Publishable key (`sb_publishable_...`) → `VITE_SUPABASE_ANON_KEY`
3. คัดลอก `.env.example` เป็น `.env` แล้วใส่ค่าทั้งสอง
   **ห้ามใส่ Secret key / service_role key ใน `.env` ของ frontend** — แอปจะ error ทันทีถ้าตรวจพบ

## 2. รัน SQL
1. **SQL Editor → New query**
2. วางเนื้อหาทั้งไฟล์ `supabase/setup.sql` แล้วกด **Run** (รันซ้ำได้ ไม่ทำข้อมูลเสีย)
3. ได้ครบ: 6 ตาราง + RLS, trigger สร้าง profile/หมวดหมู่เริ่มต้นตอนสมัคร, ฟังก์ชันสรุปยอด, bucket `avatars`, Realtime

ถ้าใช้ Supabase CLI แทนได้: `npx supabase link --project-ref <ref>` แล้ว `npx supabase db push`

## 3. URL Configuration
**Authentication → URL Configuration**
- **Site URL**: URL production เช่น `https://coinly.vercel.app` (ช่วงพัฒนาใช้ `http://localhost:5173`)
- **Redirect URLs** เพิ่มทั้งหมดนี้:
  ```
  http://localhost:5173/**
  http://localhost:4173/**
  https://coinly.vercel.app/**
  https://*-<vercel-team>.vercel.app/**
  ```
  (บรรทัดสุดท้ายสำหรับ Preview deployment ของ Vercel)

## 4. ยืนยันอีเมล + Email templates
1. **Authentication → Sign In / Providers → Email**: เปิด **Confirm email** (ค่าเริ่มต้นเปิดอยู่แล้ว)
2. **Authentication → Emails → Templates**
   - **Confirm signup**: Subject `ยืนยันอีเมลเพื่อเริ่มใช้งาน Coinly` แล้ววาง HTML จาก `supabase/email-templates/confirm-signup.html`
   - **Reset Password**: Subject `ตั้งรหัสผ่านใหม่สำหรับ Coinly` แล้ววาง HTML จาก `supabase/email-templates/reset-password.html`
   ลิงก์ในเทมเพลตใช้รูปแบบ `/auth/confirm?token_hash=...` จึงกดจากอีเมลบนคนละเครื่อง/คนละเบราว์เซอร์ได้
3. **สำคัญสำหรับ production**: อีเมลในตัวของ Supabase ส่งได้จำกัดมาก (ไม่กี่ฉบับต่อชั่วโมง) ให้ตั้ง **Authentication → Emails → SMTP Settings** ด้วยผู้ให้บริการอย่าง Resend, Postmark หรือ Amazon SES

## 5. Google OAuth
1. [Google Cloud Console](https://console.cloud.google.com/) → สร้าง/เลือกโปรเจกต์
2. **APIs & Services → OAuth consent screen**: เลือก External, ใส่ชื่อแอป อีเมลติดต่อ และ scope `email`, `profile`, `openid`
3. **Credentials → Create credentials → OAuth client ID** → Application type **Web application**
   - **Authorized JavaScript origins**: `http://localhost:5173`, `https://coinly.vercel.app`
   - **Authorized redirect URIs**: `https://<project-ref>.supabase.co/auth/v1/callback`
     (คัดลอกได้จากหน้า Supabase → Authentication → Sign In / Providers → Google)
4. คัดลอก Client ID + Client Secret ไปใส่ใน **Supabase → Authentication → Sign In / Providers → Google** แล้วเปิด **Enable**

## 6. Edge Functions (ลบบัญชี / จัดการผู้ใช้)
ต้องมี [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
```bash
npx supabase login
npx supabase functions deploy delete-account --project-ref <project-ref>
npx supabase functions deploy admin-users --project-ref <project-ref>
```
ไม่ต้องตั้ง secret เพิ่ม: บน Supabase ฟังก์ชันได้ `SUPABASE_URL`, `SUPABASE_SECRET_KEYS`, `SUPABASE_JWKS` อัตโนมัติ
secret key ใช้เฉพาะในฟังก์ชันฝั่ง server ไม่ถูกส่งไปที่เบราว์เซอร์

## 7. ตั้งตัวเองเป็น Admin คนแรก
1. สมัครสมาชิกในแอปและยืนยันอีเมลให้เรียบร้อย
2. เปิด `supabase/bootstrap-admin.sql` แก้อีเมลเป็นของคุณ แล้วรันใน SQL Editor:
   ```sql
   update public.profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'your-email@example.com');
   ```
3. รีเฟรชแอป → เมนูบัญชีมุมซ้ายล่างจะมี **หลังบ้าน (Admin)** หรือเข้า `/admin` ตรง ๆ
   admin คนต่อไปตั้งได้จากหน้า `/admin/users`

## 8. Deploy ขึ้น Vercel
1. `git init` แล้ว push ขึ้น GitHub (`.env` ถูก gitignore ไว้แล้ว ไม่หลุดขึ้น repo)
2. [vercel.com/new](https://vercel.com/new) → Import repo → Framework **Vite** (Build `npm run build`, Output `dist`)
3. **Environment Variables** (ตั้งทั้ง Production และ Preview):
   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `sb_publishable_...` |
4. กด **Deploy** — `vercel.json` ตั้ง SPA rewrite ไว้แล้ว
5. นำ URL ที่ได้ไปใส่ใน Supabase **Site URL / Redirect URLs** (ข้อ 3) และ Google **Authorized JavaScript origins** (ข้อ 5)
6. แก้ env ภายหลังต้อง **Redeploy** เพราะค่า `VITE_*` ถูกฝังตอน build

## ตรวจสอบหลังตั้งค่า
- [ ] สมัครด้วยอีเมล → ได้อีเมลยืนยัน → กดลิงก์แล้วเข้าแอปได้ ยอด ฿0.00 มีหมวดหมู่เริ่มต้น 11 หมวด
- [ ] ลืมรหัสผ่าน → ได้อีเมล → ตั้งรหัสใหม่ได้
- [ ] เข้าสู่ระบบด้วย Google ได้
- [ ] เปิดแอป 2 เครื่อง เพิ่มรายการเครื่องหนึ่ง อีกเครื่องอัปเดตเองภายในไม่กี่วินาที
- [ ] บัญชีที่สองมองไม่เห็นรายการของบัญชีแรก
- [ ] `/admin` เข้าได้เฉพาะ admin, ผู้ใช้ทั่วไปถูกส่งกลับหน้าแรก
