import { hasWebGL, useIsDesktop, useReducedMotion } from '../../hooks/useEnv';

export interface SceneQuality {
  /** ใช้ฉาก 3D ได้ (มี WebGL และไม่ได้ตั้งลดการเคลื่อนไหว) */
  enabled: boolean;
  /** อุปกรณ์จอเล็ก/มือถือ: ลดรายละเอียด */
  mobile: boolean;
  /** เปิด post-processing (bloom) เฉพาะเดสก์ท็อป */
  postprocessing: boolean;
  /** วัสดุแก้วแบบ transmission (แพง) — ปิดบนมือถือ */
  transmission: boolean;
  dpr: [number, number];
}

/** ตั้งค่าคุณภาพฉาก 3D ตามอุปกรณ์ เพื่อให้ได้ ~60fps บนมือถือระดับกลาง */
export function useSceneQuality(): SceneQuality {
  const desktop = useIsDesktop();
  const reduced = useReducedMotion();
  const enabled = hasWebGL() && !reduced;
  return {
    enabled,
    mobile: !desktop,
    postprocessing: enabled && desktop,
    transmission: desktop,
    dpr: desktop ? [1, 1.75] : [1, 1.25],
  };
}
