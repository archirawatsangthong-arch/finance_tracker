import { useSceneQuality } from '../quality';

interface Props {
  color?: string;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

/**
 * วัสดุแก้ว: เดสก์ท็อปใช้ transmission (หักเหแสงจริง) ส่วนมือถือใช้แก้วโปร่งแสงธรรมดา
 * เพราะ transmission ต้อง render ฉากซ้ำอีกรอบ ทำให้ fps ตกบนมือถือระดับกลาง
 */
export function GlassMaterial({ color = '#c4b5fd', opacity = 0.55, emissive, emissiveIntensity = 0 }: Props) {
  const q = useSceneQuality();
  if (q.transmission) {
    return (
      <meshPhysicalMaterial
        color={color}
        transmission={0.95}
        roughness={0.08}
        thickness={0.8}
        ior={1.45}
        clearcoat={1}
        clearcoatRoughness={0.05}
        iridescence={0.4}
        transparent
        opacity={0.95}
        emissive={emissive ?? color}
        emissiveIntensity={emissiveIntensity}
      />
    );
  }
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={0.1}
      metalness={0.1}
      clearcoat={1}
      transparent
      opacity={opacity}
      depthWrite={false}
      emissive={emissive ?? color}
      emissiveIntensity={emissiveIntensity}
    />
  );
}
