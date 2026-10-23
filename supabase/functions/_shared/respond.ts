// ตัวช่วยตอบกลับแบบ JSON สำหรับ Edge Functions (CORS จัดการโดย withSupabase แล้ว)

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const fail = (message: string, status = 400): Response => json({ error: message }, status);

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
