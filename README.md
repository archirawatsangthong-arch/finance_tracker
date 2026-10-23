# Coinly — บันทึกรายรับรายจ่ายส่วนตัว

เว็บแอปบันทึกรายรับรายจ่าย แบบ Minimal + Glassmorphism พร้อม 3D (React Three Fiber)
มีระบบสมาชิก (Supabase Auth) ข้อมูลแยกตามผู้ใช้ด้วย Row Level Security และซิงก์ข้ามอุปกรณ์แบบ realtime

## เริ่มต้นใช้งาน

ต้องใช้ Node.js 20 ขึ้นไป และตั้งค่า Supabase ตาม **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** ก่อน

```bash
npm install
cp .env.example .env   # ใส่ VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:5173
npm test               # unit test + ทดสอบ SQL/RLS บน Postgres จำลอง (PGlite)
npm run build          # ตรวจ type + build production
```

## คีย์ลัด

| ปุ่ม | การทำงาน |
| --- | --- |
| `N` | เพิ่มรายการ |
| `/` | ค้นหา |
| `D` | สลับธีม |
| `Esc` | ปิดหน้าต่าง |

ช่อง "พิมพ์เร็ว" รับข้อความอย่าง `กาแฟ 65`, `เงินเดือน +35000`, `grab 120+45`, `ฟรีแลนซ์ 5k`

## โครงสร้างโปรเจกต์

```
supabase/
├── migrations/                # SQL แยกเป็นขั้น (ตาราง, RLS, ฟังก์ชัน, import/admin, storage/realtime)
├── setup.sql                  # รวมทุก migration — วางใน SQL Editor แล้วรันได้เลย
├── bootstrap-admin.sql        # ตั้ง admin คนแรก
├── functions/                 # Edge Functions: delete-account, admin-users
├── email-templates/           # อีเมลยืนยัน/รีเซ็ตรหัสผ่านภาษาไทย
└── tests/                     # ทดสอบ migration + RLS บน PGlite
src/
├── main.tsx, App.tsx          # QueryClient, router, protected routes
├── lib/
│   ├── supabase.ts            # Supabase client (กัน secret key หลุดเข้า frontend)
│   ├── api.ts                 # ชั้นเข้าถึงข้อมูล: snake_case ↔ camelCase
│   ├── actions.ts             # บันทึก/ลบแบบ optimistic + rollback + Undo
│   ├── queryClient.ts         # TanStack Query: retry, toast error, query keys
│   ├── validation.ts          # Zod schema (ข้อความ error ภาษาไทย)
│   ├── errors.ts              # แปลง error เป็นภาษาไทย
│   ├── backup.ts, avatar.ts, adminApi.ts
│   └── calculator.ts, parser.ts, stats.ts, date.ts, format.ts
├── store/                     # Zustand: auth, settings, UI/toast
├── hooks/                     # useData (queries), useSummary, useSync (realtime), useHotkeys
├── components/
│   ├── auth/                  # AuthLayout, Field, GoogleButton, Guards
│   ├── layout/                # Sidebar, UserMenu, BottomNav, PinLock
│   ├── three/, charts/, ui/, transactions/, budget/, settings/
└── pages/
    ├── Dashboard, Transactions, Analytics, BudgetGoals, Settings, Account
    ├── auth/                  # Login, Register, ForgotPassword, ResetPassword, AuthCallback
    └── admin/                 # AdminLayout, AdminDashboard, AdminUsers
```

## ความปลอดภัย

- frontend ใช้เฉพาะ publishable key — RLS บังคับให้ผู้ใช้เห็นเฉพาะแถวที่ `user_id = auth.uid()`
- สิทธิ์ระดับคอลัมน์: ผู้ใช้แก้ `role` / `is_suspended` / `user_id` ของตัวเองไม่ได้
- composite foreign key กันการอ้างหมวดหมู่ของผู้ใช้อื่น
- งานสิทธิ์สูง (ลบบัญชี, ระงับ/เปลี่ยน role) ทำใน Edge Functions ที่ตรวจ JWT และสิทธิ์ admin จากฐานข้อมูล
- admin เห็นเฉพาะสถิติรวมและรายชื่อผู้ใช้ — ไม่มี policy หรือฟังก์ชันใดให้อ่านรายการเงินของผู้อื่น
- ตรวจข้อมูลสองชั้น: Zod ในฟอร์ม + CHECK constraint ในฐานข้อมูล (จำนวนเงิน > 0, ความยาวข้อความ)
- Realtime ส่งเฉพาะชื่อตารางที่เปลี่ยน ผ่าน private channel `user:<id>` ที่มี RLS กำกับ
- PIN เป็นการล็อกหน้าจอเฉพาะเครื่อง (เสริม) ไม่ใช่การเข้ารหัสข้อมูล

## ประสิทธิภาพ 3D

- three.js แยกเป็น chunk และ lazy load เฉพาะตอนต้องแสดง 3D
- Hero หยุด render เมื่อเลื่อนพ้นจอ และลด DPR เองเมื่อ FPS ตก (`PerformanceMonitor`)
- แสงสะท้อนใช้ Lightformer แบบ procedural ไม่ต้องโหลดไฟล์ HDR (ใช้ offline ได้)
- พื้นหลัง particles ใช้ Canvas 2D (ไม่เปิด WebGL context เพิ่ม) และหยุดเมื่อแท็บถูกซ่อน
- ถ้าตั้ง `prefers-reduced-motion`, ตั้ง "ลด" ใน Settings หรือไม่มี WebGL จะแสดงภาพ SVG นิ่งแทน

## Deploy

ดูขั้นตอน Vercel และการตั้ง Environment Variables ใน [SUPABASE_SETUP.md](SUPABASE_SETUP.md#8-deploy-ขึ้น-vercel)
