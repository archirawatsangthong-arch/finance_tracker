// งานหลังบ้านที่ต้องใช้สิทธิ์สูง: ระงับ/เปิดใช้งานผู้ใช้ และเปลี่ยน role
// ตรวจสิทธิ์ admin จากฐานข้อมูลทุกครั้ง (ไม่เชื่อค่าจาก client)
import { withSupabase } from 'npm:@supabase/server@1.9.2';
import { fail, json, readJson, UUID_RE } from '../_shared/respond.ts';

type Action = { action: 'set_suspended'; userId: string; suspended: boolean } | { action: 'set_role'; userId: string; role: 'user' | 'admin' };

// ระงับนานมาก ≈ ถาวร จนกว่าจะเปิดใช้งาน (ทำให้ล็อกอินและ refresh token ไม่ได้)
const BAN_DURATION = '876000h';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail('Method not allowed', 405);
    const callerId = ctx.userClaims?.id;
    if (!callerId) return fail('ไม่ได้รับอนุญาต', 401);

    const { data: caller } = await ctx.supabaseAdmin.from('profiles').select('role, is_suspended').eq('id', callerId).single();
    if (!caller || caller.role !== 'admin' || caller.is_suspended) return fail('สำหรับผู้ดูแลระบบเท่านั้น', 403);

    const body = await readJson<Action>(req);
    if (!body || typeof body.userId !== 'string' || !UUID_RE.test(body.userId)) return fail('ข้อมูลไม่ถูกต้อง');
    if (body.userId === callerId) return fail('ไม่สามารถเปลี่ยนสถานะหรือสิทธิ์ของตัวเองได้');

    const { data: target } = await ctx.supabaseAdmin.from('profiles').select('id, role').eq('id', body.userId).single();
    if (!target) return fail('ไม่พบผู้ใช้', 404);

    if (body.action === 'set_suspended') {
      if (typeof body.suspended !== 'boolean') return fail('ข้อมูลไม่ถูกต้อง');
      const { error: banError } = await ctx.supabaseAdmin.auth.admin.updateUserById(body.userId, {
        ban_duration: body.suspended ? BAN_DURATION : 'none',
      });
      if (banError) return fail('อัปเดตสถานะไม่สำเร็จ', 500);
      const { error } = await ctx.supabaseAdmin.from('profiles').update({ is_suspended: body.suspended }).eq('id', body.userId);
      if (error) return fail('อัปเดตสถานะไม่สำเร็จ', 500);
      return json({ ok: true });
    }

    if (body.action === 'set_role') {
      if (body.role !== 'user' && body.role !== 'admin') return fail('ข้อมูลไม่ถูกต้อง');
      const { error } = await ctx.supabaseAdmin.from('profiles').update({ role: body.role }).eq('id', body.userId);
      if (error) return fail('เปลี่ยนสิทธิ์ไม่สำเร็จ', 500);
      return json({ ok: true });
    }

    return fail('ไม่รู้จักคำสั่งนี้');
  }),
};
