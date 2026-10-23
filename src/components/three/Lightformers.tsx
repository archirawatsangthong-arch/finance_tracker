import { Environment, Lightformer } from '@react-three/drei';

/** environment lighting แบบ procedural — สะท้อนแสงบนโลหะสวย ไม่ต้องโหลดไฟล์ HDR */
export function Lightformers({ resolution = 256 }: { resolution?: number }) {
  return (
    <Environment resolution={resolution} frames={1}>
      <color attach="background" args={['#0a0a0f']} />
      <Lightformer form="rect" intensity={4} color="#ffffff" position={[0, 5, -6]} scale={[10, 4, 1]} />
      <Lightformer form="rect" intensity={3} color="#a78bfa" position={[-6, 1, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
      <Lightformer form="rect" intensity={3} color="#60a5fa" position={[6, -1, 2]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
      <Lightformer form="ring" intensity={2} color="#f0abfc" position={[0, -4, 4]} scale={4} />
      <Lightformer form="circle" intensity={2.5} color="#ffffff" position={[2, 3, 5]} scale={2} />
    </Environment>
  );
}
