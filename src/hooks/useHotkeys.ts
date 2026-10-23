import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../store/settings';
import { useUI } from '../store/ui';

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/** คีย์ลัด: N = เพิ่มรายการ, / = ค้นหา, D = สลับธีม (ไม่ทำงานขณะพิมพ์) */
export function useHotkeys(enabled: boolean): void {
  const navigate = useNavigate();
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (useUI.getState().editor) return;
      const k = e.key.toLowerCase();
      if (k === 'n' || k === 'ท') {
        e.preventDefault();
        useUI.getState().openEditor();
      } else if (k === '/' || k === 'ฝ') {
        e.preventDefault();
        navigate('/app/transactions');
        // รอหน้า transactions mount ก่อนสั่ง focus
        setTimeout(() => useUI.getState().focusSearch(), 50);
      } else if (k === 'd' || k === 'ก') {
        useSettings.getState().toggleTheme();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, navigate]);
}
