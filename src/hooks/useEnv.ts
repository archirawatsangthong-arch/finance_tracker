import { useEffect, useState } from 'react';
import { useSettings } from '../store/settings';

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const fn = () => setMatch(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [query]);
  return match;
}

/** รวมค่าจากระบบ (prefers-reduced-motion) กับค่าที่ผู้ใช้ตั้งเอง */
export function useReducedMotion(): boolean {
  const system = useMedia('(prefers-reduced-motion: reduce)');
  const pref = useSettings((s) => s.motion);
  return pref === 'reduce' || (pref === 'system' && system);
}

export const useIsDesktop = (): boolean => useMedia('(min-width: 1024px)');

export const useHoverCapable = (): boolean => useMedia('(hover: hover) and (pointer: fine)');

let webglCache: boolean | null = null;

/** ตรวจว่ารองรับ WebGL หรือไม่ (ทดสอบครั้งเดียวแล้ว cache) */
export function hasWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const c = document.createElement('canvas');
    webglCache = !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    webglCache = false;
  }
  return webglCache;
}
