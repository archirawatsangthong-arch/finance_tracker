// ลบบัญชีของผู้เรียกเองอย่างถาวร (ข้อมูลทุกตารางถูกลบตาม ON DELETE CASCADE)
// ต้องส่ง { confirm: "ลบบัญชี" } มาด้วย กันการเรียกโดยไม่ตั้งใจ
import { withSupabase } from 'npm:@supabase/server@1.9.2';
import { fail, json, readJson } from '../_shared/respond.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail('Method not allowed', 405);
    const userId = ctx.userClaims?.id;
    if (!userId) return fail('ไม่ได้รับอนุญาต', 401);

    const body = await readJson<{ confirm?: string }>(req);
    if (body?.confirm !== 'ลบบัญชี') return fail('ข้อความยืนยันไม่ถูกต้อง');

    // ลบรูปโปรไฟล์ทั้งหมดในโฟลเดอร์ของผู้ใช้ก่อน (Storage ไม่ cascade ตาม auth.users)
    const { data: files } = await ctx.supabaseAdmin.storage.from('avatars').list(userId, { limit: 100 });
    if (files?.length) {
      await ctx.supabaseAdmin.storage.from('avatars').remove(files.map((f) => `${userId}/${f.name}`));
    }

    const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) return fail('ลบบัญชีไม่สำเร็จ กรุณาลองใหม่', 500);
    return json({ ok: true });
  }),
};
