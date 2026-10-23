import { lazy, Suspense, type ReactNode } from 'react';
import { hasWebGL, useReducedMotion } from '../../hooks/useEnv';
import { StaticCoin } from '../three/StaticCoin';

const MiniCoin = lazy(() => import('../three/MiniCoinScene'));

interface Props {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** empty state พร้อมเหรียญ 3D ขนาดเล็ก (fallback เป็นภาพนิ่งถ้าไม่มี WebGL) */
export function EmptyState({ title, description, action }: Props) {
  const reduced = useReducedMotion();
  const use3D = hasWebGL() && !reduced;
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 h-32 w-32">
        {use3D ? (
          <Suspense fallback={<StaticCoin className="h-full w-full" />}>
            <MiniCoin />
          </Suspense>
        ) : (
          <StaticCoin className="h-full w-full" />
        )}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
