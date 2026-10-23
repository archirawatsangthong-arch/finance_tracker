// ทดสอบ SQL migration บน PGlite (Postgres ใน process) พร้อม schema จำลองของ Supabase
// ครอบคลุม: trigger สมัครสมาชิก, RLS แยกผู้ใช้, สิทธิ์คอลัมน์, รายการซ้ำ, งบ, import, admin
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const migrations = readdirSync(join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort();

let db: PGlite;
const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const ADMIN = '00000000-0000-0000-0000-0000000000ad';

/** รัน query ในฐานะผู้ใช้ (ตั้ง role authenticated + jwt sub) ภายใน transaction */
async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? '']);
    const r = await tx.query<T>(sql, params);
    return r.rows;
  });
}

const rejects = async (p: Promise<unknown>) => {
  let err: unknown = null;
  try {
    await p;
  } catch (e) {
    err = e;
  }
  expect(err, 'expected query to fail').not.toBeNull();
  return err as Error;
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(join(__dirname, 'stub.sql'), 'utf8'));
  for (const f of migrations) await db.exec(readFileSync(join(root, 'migrations', f), 'utf8'));
  // รันซ้ำอีกรอบเพื่อยืนยันว่า idempotent
  for (const f of migrations) await db.exec(readFileSync(join(root, 'migrations', f), 'utf8'));
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'a@x.com', '{"full_name":"Alice"}'), ($2, 'b@x.com', '{}'), ($3, 'admin@x.com', '{}')`, [A, B, ADMIN]);
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
}, 60_000);

describe('signup trigger', () => {
  it('creates profile and 11 default categories', async () => {
    const [p] = await as<{ display_name: string; role: string }>(A, 'select display_name, role from profiles');
    expect(p).toEqual({ display_name: 'Alice', role: 'user' });
    const [b] = await as<{ display_name: string }>(B, 'select display_name from profiles');
    expect(b.display_name).toBe('b');
    const cats = await as(A, 'select * from categories');
    expect(cats).toHaveLength(11);
  });
});

describe('RLS isolation', () => {
  it('users only see their own rows', async () => {
    const [food] = await as<{ id: string }>(A, `select id from categories where name = 'อาหาร'`);
    await as(A, `insert into transactions (type, amount, category_id, date, note) values ('expense', 65, $1, '2026-10-01', 'กาแฟ')`, [food.id]);
    expect(await as(A, 'select * from transactions')).toHaveLength(1);
    expect(await as(B, 'select * from transactions')).toHaveLength(0);
    expect(await as(B, 'select * from profiles')).toHaveLength(1);
    expect(await as(null, 'select 1').catch(() => [])).toBeDefined();
  });

  it('anon cannot read anything', async () => {
    await rejects(as(null, 'select * from transactions'));
    await rejects(as(null, 'select * from profiles'));
  });

  it('cannot insert rows for another user or with another user category', async () => {
    const [food] = await as<{ id: string }>(A, `select id from categories where name = 'อาหาร'`);
    // ใช้หมวดของ A ในชื่อ B → composite FK ล้มเหลว
    await rejects(as(B, `insert into transactions (type, amount, category_id, date) values ('expense', 10, $1, '2026-10-01')`, [food.id]));
    // ตั้ง user_id เองไม่ได้ (ไม่มีสิทธิ์คอลัมน์)
    const [bfood] = await as<{ id: string }>(B, `select id from categories where name = 'อาหาร'`);
    await rejects(as(B, `insert into transactions (user_id, type, amount, category_id, date) values ($1, 'expense', 10, $2, '2026-10-01')`, [A, bfood.id]));
  });

  it('cannot update or delete another user rows', async () => {
    const r = await as(B, `update transactions set amount = 1 returning id`);
    expect(r).toHaveLength(0);
    const d = await as(B, `delete from transactions returning id`);
    expect(d).toHaveLength(0);
    expect(await as(A, 'select * from transactions')).toHaveLength(1);
  });

  it('validates amounts and lengths', async () => {
    const [food] = await as<{ id: string }>(A, `select id from categories where name = 'อาหาร'`);
    await rejects(as(A, `insert into transactions (type, amount, category_id, date) values ('expense', -5, $1, '2026-10-01')`, [food.id]));
    await rejects(as(A, `insert into transactions (type, amount, category_id, date) values ('expense', 0, $1, '2026-10-01')`, [food.id]));
    await rejects(as(A, `insert into transactions (type, amount, category_id, date, note) values ('expense', 5, $1, '2026-10-01', repeat('x', 201))`, [food.id]));
    await rejects(as(A, `insert into goals (name, target_amount) values ('x', -1)`));
  });
});

describe('profile privileges', () => {
  it('cannot escalate own role or unsuspend', async () => {
    await rejects(as(A, `update profiles set role = 'admin'`));
    await rejects(as(A, `update profiles set is_suspended = false`));
    const r = await as(A, `update profiles set display_name = 'Alice 2', theme = 'light' returning display_name`);
    expect(r).toHaveLength(1);
  });

  it('suspended user loses access', async () => {
    await db.query(`update public.profiles set is_suspended = true where id = $1`, [B]);
    expect(await as(B, 'select * from categories')).toHaveLength(0);
    await rejects(as(B, `select clear_my_data('ล้างข้อมูล')`));
    await db.query(`update public.profiles set is_suspended = false where id = $1`, [B]);
    expect(await as(B, 'select * from categories')).toHaveLength(11);
  });
});

describe('recurring', () => {
  it('create_recurring_rule creates first + catch-up rows and is idempotent', async () => {
    const [bills] = await as<{ id: string }>(B, `select id from categories where name = 'บิล/ค่าน้ำไฟ'`);
    await as(B, `select create_recurring_rule('expense', 8500, $1, '2026-01-31', 'ค่าเช่า', 'transfer', 'monthly', '2026-04-15')`, [bills.id]);
    const rows = await as<{ date: string }>(B, `select to_char(date, 'YYYY-MM-DD') as date from transactions where recurring_rule_id is not null order by date`);
    expect(rows.map((r) => r.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    const [rule] = await as<{ next: string; occurrences: number }>(B, `select to_char(next_run_date, 'YYYY-MM-DD') as next, occurrences from recurring_rules`);
    expect(rule).toEqual({ next: '2026-04-30', occurrences: 3 });
    const [{ process_recurring }] = await as<{ process_recurring: number }>(B, `select process_recurring('2026-04-15')`);
    expect(process_recurring).toBe(0);
  });

  it('cannot set occurrences directly', async () => {
    await rejects(as(B, `update recurring_rules set occurrences = 0`));
  });
});

describe('budgets', () => {
  it('carries forward and supports clearing', async () => {
    const [food] = await as<{ id: string }>(A, `select id from categories where name = 'อาหาร'`);
    await as(A, `select set_budgets('2026-08-15', $1::jsonb)`, [JSON.stringify([{ category_id: null, amount: 25000 }, { category_id: food.id, amount: 7000 }])]);
    let b = await as<{ amount: string }>(A, `select amount from get_budgets('2026-10-01') order by amount`);
    expect(b.map((x) => Number(x.amount))).toEqual([7000, 25000]);
    expect(await as(A, `select * from get_budgets('2026-07-01')`)).toHaveLength(0);
    await as(A, `select set_budgets('2026-10-01', $1::jsonb)`, [JSON.stringify([{ category_id: food.id, amount: null }])]);
    b = await as(A, `select amount from get_budgets('2026-10-01')`);
    expect(b).toHaveLength(1);
    expect(await as(A, `select * from get_budgets('2026-09-01')`)).toHaveLength(2);
  });
});

describe('summary & search', () => {
  it('monthly summary fills empty months', async () => {
    const rows = await as<{ expense: string }>(A, `select * from get_monthly_summary('2026-08-01', '2026-10-01')`);
    expect(rows.map((r) => Number(r.expense))).toEqual([0, 0, 65]);
  });
  it('search escapes LIKE wildcards', async () => {
    expect(await as(A, `select * from search_transactions('%')`)).toHaveLength(0);
    expect(await as(A, `select * from search_transactions('กาแฟ')`)).toHaveLength(1);
    expect(await as(A, `select * from search_transactions('อาหาร')`)).toHaveLength(1);
  });
});

describe('categories', () => {
  it('delete_category moves transactions to fallback; fallback cannot be deleted', async () => {
    const [food] = await as<{ id: string }>(A, `select id from categories where name = 'อาหาร'`);
    const [{ delete_category }] = await as<{ delete_category: number }>(A, `select delete_category($1)`, [food.id]);
    expect(delete_category).toBe(1);
    const [tx] = await as<{ name: string }>(A, `select c.name from transactions t join categories c on c.id = t.category_id`);
    expect(tx.name).toBe('อื่น ๆ');
    const [other] = await as<{ id: string }>(A, `select id from categories where system_key = 'other_expense'`);
    await rejects(as(A, `select delete_category($1)`, [other.id]));
    expect(await as(A, `delete from categories where id = $1 returning id`, [other.id])).toHaveLength(0);
  });
});

describe('import', () => {
  it('append CSV rows with category names, skipping invalid ones', async () => {
    const payload = {
      transactions: [
        { type: 'expense', amount: '120.5', category_name: 'สัตว์เลี้ยง', date: '2026-09-01', note: 'อาหารแมว' },
        { type: 'income', amount: '1000', category_name: 'เงินเดือน', date: '2026-09-02' },
        { type: 'expense', amount: '-5', category_name: 'x', date: '2026-09-01' },
        { type: 'expense', amount: '5', date: 'not-a-date' },
      ],
    };
    const [{ import_data }] = await as<{ import_data: { transactions: number; skipped: number } }>(A, `select import_data($1::jsonb, 'append')`, [JSON.stringify(payload)]);
    expect(import_data).toMatchObject({ transactions: 2, skipped: 2 });
    expect(await as(A, `select * from categories where name = 'สัตว์เลี้ยง'`)).toHaveLength(1);
  });

  it('replace restores a backup and remaps ids', async () => {
    const backup = {
      categories: [{ id: 'c1', name: 'กาแฟ', type: 'expense', icon: 'coffee', color: '#F59E0B' }],
      transactions: [{ type: 'expense', amount: 55, category_id: 'c1', date: '2026-10-02', recurring_rule_id: 'r1' }],
      recurring_rules: [{ id: 'r1', type: 'expense', amount: 55, category_id: 'c1', frequency: 'daily', start_date: '2026-10-02', next_run_date: '2026-10-03', occurrences: 1 }],
      budgets: [{ category_id: 'c1', amount: 1500, month: '2026-10-01' }, { category_id: null, amount: 9000, month: '2026-10-01' }],
      goals: [{ name: 'ญี่ปุ่น', target_amount: 50000, current_amount: 100 }],
    };
    await as(B, `select import_data($1::jsonb, 'replace')`, [JSON.stringify(backup)]);
    const cats = await as<{ name: string }>(B, `select name from categories order by name`);
    expect(cats.map((c) => c.name).sort()).toEqual(['กาแฟ', 'รายรับอื่น ๆ', 'อื่น ๆ'].sort());
    const [tx] = await as<{ rid: string | null }>(B, `select recurring_rule_id as rid from transactions`);
    expect(tx.rid).not.toBeNull();
    expect(await as(B, `select * from get_budgets('2026-10-01')`)).toHaveLength(2);
    expect(await as(B, 'select * from goals')).toHaveLength(1);
  });
});

describe('goals', () => {
  it('apply_goal_delta clamps at 0', async () => {
    const [g] = await as<{ id: string }>(B, 'select id from goals');
    const [r] = await as<{ current_amount: string }>(B, `select current_amount from apply_goal_delta($1, -999999)`, [g.id]);
    expect(Number(r.current_amount)).toBe(0);
    expect(await as(A, `select * from apply_goal_delta($1, 100)`, [g.id])).toHaveLength(0);
  });
});

describe('admin', () => {
  it('non-admin is rejected', async () => {
    await rejects(as(A, 'select * from admin_overview()'));
    await rejects(as(A, 'select * from admin_list_users()'));
  });
  it('admin sees aggregates and user list but not transactions', async () => {
    const [o] = await as<{ total_users: string; total_transactions: string }>(ADMIN, 'select * from admin_overview()');
    expect(Number(o.total_users)).toBe(3);
    expect(Number(o.total_transactions)).toBeGreaterThan(0);
    const users = await as<{ email: string }>(ADMIN, `select * from admin_list_users('a@')`);
    expect(users.map((u) => u.email)).toEqual(['a@x.com']);
    expect(await as(ADMIN, 'select * from transactions')).toHaveLength(0);
    expect(await as(ADMIN, 'select * from goals')).toHaveLength(0);
    expect(await as(ADMIN, 'select * from profiles')).toHaveLength(3);
    expect(await as(ADMIN, 'select * from admin_daily_stats(7)')).toHaveLength(7);
    expect(await as(ADMIN, 'select * from admin_monthly_stats(3)')).toHaveLength(3);
  });
});

describe('realtime', () => {
  it('broadcasts to owner channel and policy restricts by topic', async () => {
    const sent = await db.query<{ topic: string }>(`select distinct topic from realtime.sent`);
    expect(sent.rows.map((r) => r.topic)).toContain(`user:${A}`);
    await db.query(`insert into realtime.messages values ('user:${A}', 'broadcast', '{}', 'change', true)`);
    const read = (uid: string, topic: string) =>
      db.transaction(async (tx) => {
        await tx.exec(`set local role authenticated`);
        await tx.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('realtime.topic', $2, true)`, [uid, topic]);
        return (await tx.query('select * from realtime.messages')).rows;
      });
    expect(await read(A, `user:${A}`)).toHaveLength(1);
    expect(await read(B, `user:${A}`)).toHaveLength(0);
  });
});

describe('storage', () => {
  it('users can only write into their own avatar folder', async () => {
    await as(A, `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${A}/a.png`]);
    await rejects(as(B, `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${A}/b.png`]));
  });
});

describe('clear_my_data', () => {
  it('requires confirm text and reseeds categories', async () => {
    await rejects(as(A, `select clear_my_data('yes')`));
    await as(A, `select clear_my_data('ล้างข้อมูล')`);
    expect(await as(A, 'select * from transactions')).toHaveLength(0);
    expect(await as(A, 'select * from categories')).toHaveLength(11);
  });
});
