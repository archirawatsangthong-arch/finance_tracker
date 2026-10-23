import { create } from 'zustand';
import type { Transaction } from '../types';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
  duration: number;
}

interface UIState {
  /** เปิด Quick Add: null = ปิด, 'new' = รายการใหม่, Transaction = แก้ไข */
  editor: null | 'new' | Transaction;
  /** เพิ่มขึ้นทุกครั้งที่บันทึกสำเร็จ — ใช้ trigger อนิเมชันเหรียญหล่นลงกระปุก */
  celebrate: number;
  searchFocus: number;
  toasts: Toast[];
  openEditor: (tx?: Transaction) => void;
  closeEditor: () => void;
  fireCelebrate: () => void;
  focusSearch: () => void;
  toast: (message: string, opts?: Partial<Omit<Toast, 'id' | 'message'>>) => void;
  dismissToast: (id: number) => void;
}

let toastId = 0;

export const useUI = create<UIState>()((set, get) => ({
  editor: null,
  celebrate: 0,
  searchFocus: 0,
  toasts: [],
  openEditor: (tx) => set({ editor: tx ?? 'new' }),
  closeEditor: () => set({ editor: null }),
  fireCelebrate: () => set({ celebrate: get().celebrate + 1 }),
  focusSearch: () => set({ searchFocus: get().searchFocus + 1 }),
  toast: (message, opts) => {
    const t: Toast = { id: ++toastId, message, kind: opts?.kind ?? 'success', action: opts?.action, duration: opts?.duration ?? 3500 };
    set({ toasts: [...get().toasts.slice(-2), t] });
    setTimeout(() => get().dismissToast(t.id), t.duration);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = (...args: Parameters<UIState['toast']>) => useUI.getState().toast(...args);
