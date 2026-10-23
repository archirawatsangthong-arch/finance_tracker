import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';
export type Era = 'BE' | 'CE';
export type Currency = 'THB' | 'USD' | 'EUR' | 'JPY';
export type MotionPref = 'system' | 'reduce' | 'full';

type SyncedPatch = Partial<{ theme: Theme; era: Era; currency: Currency }>;

interface SettingsState {
  // ซิงก์กับ profile ในบัญชี (ใช้ได้ทุกอุปกรณ์)
  theme: Theme;
  era: Era;
  currency: Currency;
  // เฉพาะเครื่องนี้
  privacy: boolean;
  motion: MotionPref;
  /** PIN ล็อกหน้าจอของเครื่องนี้: PBKDF2 hash + salt (ไม่เก็บ PIN ตรง ๆ) */
  pinHash: string | null;
  pinSalt: string | null;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setEra: (e: Era) => void;
  setCurrency: (c: Currency) => void;
  togglePrivacy: () => void;
  setMotion: (m: MotionPref) => void;
  setPin: (hash: string | null, salt: string | null) => void;
  /** รับค่าจาก profile บน server (ไม่ส่งกลับไปซ้ำ) */
  applyRemote: (patch: SyncedPatch) => void;
}

const applyTheme = (t: Theme) => {
  document.documentElement.classList.toggle('dark', t === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0A0A0F' : '#F5F5FA');
};

// ตัวส่งค่าที่ผู้ใช้เปลี่ยนไปบันทึกใน profile (ตั้งโดย useSync เมื่อล็อกอิน)
let remoteSync: ((patch: SyncedPatch) => void) | null = null;
export const setRemoteSettingsSync = (fn: typeof remoteSync) => {
  remoteSync = fn;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      era: 'BE',
      currency: 'THB',
      privacy: false,
      motion: 'system',
      pinHash: null,
      pinSalt: null,
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
        remoteSync?.({ theme });
      },
      toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
      setEra: (era) => {
        set({ era });
        remoteSync?.({ era });
      },
      setCurrency: (currency) => {
        set({ currency });
        remoteSync?.({ currency });
      },
      togglePrivacy: () => set({ privacy: !get().privacy }),
      setMotion: (motion) => set({ motion }),
      setPin: (pinHash, pinSalt) => set({ pinHash, pinSalt }),
      applyRemote: (patch) => {
        if (patch.theme && patch.theme !== get().theme) applyTheme(patch.theme);
        set(patch);
      },
    }),
    {
      name: 'coinly-settings',
      onRehydrateStorage: () => (state) => state && applyTheme(state.theme),
    },
  ),
);
