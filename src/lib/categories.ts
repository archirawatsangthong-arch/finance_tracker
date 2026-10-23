// หมวดหมู่เริ่มต้นสร้างในฐานข้อมูลตอนสมัคร (ดู supabase/migrations: private.seed_default_categories)

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'เงินสด' },
  { id: 'card', label: 'บัตร' },
  { id: 'transfer', label: 'โอน' },
  { id: 'qr', label: 'สแกน QR' },
  { id: 'ewallet', label: 'e-Wallet' },
] as const;

export const paymentLabel = (id: string): string => PAYMENT_METHODS.find((p) => p.id === id)?.label ?? id;
