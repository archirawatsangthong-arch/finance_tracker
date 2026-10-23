/** แสดงเมื่อยังไม่ได้ตั้งค่า .env — ช่วยให้นักพัฒนารู้ว่าต้องทำอะไรต่อ */
export function SetupNotice() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="glass max-w-lg rounded-3xl p-8">
        <h1 className="text-xl font-semibold">ยังไม่ได้เชื่อมต่อ Supabase</h1>
        <p className="mt-2 text-sm text-muted">สร้างไฟล์ <code className="rounded bg-fg/10 px-1.5">.env</code> ที่โฟลเดอร์โปรเจกต์ (คัดลอกจาก .env.example) แล้วรีสตาร์ท dev server</p>
        <pre className="num mt-4 overflow-x-auto rounded-xl bg-fg/5 p-4 text-xs">
          {`VITE_SUPABASE_URL=https://xxxx.supabase.co\nVITE_SUPABASE_ANON_KEY=sb_publishable_...`}
        </pre>
      </div>
    </div>
  );
}
