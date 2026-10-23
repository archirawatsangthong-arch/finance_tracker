import { supabase } from './supabase';

const MAX_INPUT = 10 * 1024 * 1024;
const SIZE = 256;

/** ย่อรูปเป็น 256×256 (crop กลาง) และแปลงเป็น WebP — ไฟล์เล็ก และตัด EXIF/ตำแหน่ง GPS ออก */
async function resize(file: File): Promise<Blob> {
  if (!/^image\/(png|jpe?g|webp|gif|heic|heif)$/i.test(file.type)) throw new Error('รองรับเฉพาะไฟล์รูปภาพ (PNG, JPG, WebP)');
  if (file.size > MAX_INPUT) throw new Error('ไฟล์รูปใหญ่เกิน 10 MB');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('อ่านไฟล์รูปไม่ได้ ลองใช้ไฟล์ PNG หรือ JPG');
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('แปลงรูปไม่สำเร็จ'))), 'image/webp', 0.85),
  );
}

/** อัปโหลดรูปโปรไฟล์ไปที่ avatars/<user_id>/... แล้วคืน public URL (ลบรูปเก่าทิ้ง) */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const blob = await resize(file);
  const bucket = supabase.storage.from('avatars');
  const path = `${userId}/${Date.now()}.webp`;
  const { error } = await bucket.upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
  if (error) throw error;
  // ลบไฟล์เก่าในโฟลเดอร์ (ไม่ให้ค้างใน Storage)
  const { data: old } = await bucket.list(userId, { limit: 100 });
  const stale = (old ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== path);
  if (stale.length) await bucket.remove(stale);
  return bucket.getPublicUrl(path).data.publicUrl;
}

export async function removeAvatarFiles(userId: string): Promise<void> {
  const bucket = supabase.storage.from('avatars');
  const { data } = await bucket.list(userId, { limit: 100 });
  if (data?.length) await bucket.remove(data.map((f) => `${userId}/${f.name}`));
}
