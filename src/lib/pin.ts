// แฮช PIN ด้วย PBKDF2 (Web Crypto) — ไม่เก็บ PIN จริงไว้ในเครื่อง
// หมายเหตุ: เป็นการป้องกันระดับ "ล็อกหน้าจอ" ไม่ใช่การเข้ารหัสข้อมูลใน IndexedDB

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export const newSalt = (): string => toHex(crypto.getRandomValues(new Uint8Array(16)));

export async function hashPin(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 120_000, hash: 'SHA-256' },
    key,
    256,
  );
  return toHex(bits);
}

export async function verifyPin(pin: string, salt: string, hash: string): Promise<boolean> {
  return (await hashPin(pin, salt)) === hash;
}
