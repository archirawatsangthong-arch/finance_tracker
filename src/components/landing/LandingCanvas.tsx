import { PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useState, type ReactNode } from 'react';
import { Lightformers } from '../three/Lightformers';
import { useSceneQuality } from './quality';

interface Props {
  children: ReactNode;
  paused: boolean;
  camera?: { position: [number, number, number]; fov: number };
  /** ความแรงของ bloom (เฉพาะเดสก์ท็อป) */
  bloom?: number;
}

/**
 * Canvas มาตรฐานของหน้า Landing: แสง + environment แบบ procedural + bloom เบา ๆ
 * - หยุด render (frameloop "never") เมื่ออยู่นอกจอ
 * - ลด dpr อัตโนมัติถ้า fps ตก, ปิด bloom บนมือถือ
 */
export default function LandingCanvas({ children, paused, camera = { position: [0, 0, 6], fov: 35 }, bloom = 0.55 }: Props) {
  const q = useSceneQuality();
  const [dpr, setDpr] = useState(q.dpr[1]);
  const [fx, setFx] = useState(q.postprocessing);
  return (
    <Canvas
      dpr={[q.dpr[0], dpr]}
      frameloop={paused ? 'never' : 'always'}
      camera={camera}
      gl={{ antialias: !q.postprocessing, alpha: true, powerPreference: 'high-performance' }}
      eventSource={document.getElementById('root') ?? undefined}
      eventPrefix="client"
    >
      <PerformanceMonitor
        onDecline={() => {
          setDpr(1);
          setFx(false);
        }}
        onIncline={() => setDpr(q.dpr[1])}
        flipflops={3}
        onFallback={() => {
          setDpr(1);
          setFx(false);
        }}
      />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} />
      <pointLight position={[-4, -2, 3]} intensity={18} color="#6366f1" />
      {children}
      <Lightformers resolution={q.mobile ? 128 : 256} />
      {fx && (
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={bloom} luminanceThreshold={0.62} luminanceSmoothing={0.25} radius={0.7} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
