import { BarChart3, FolderKanban, LockKeyhole, PiggyBank, Smartphone } from 'lucide-react';
import { StaticCoin } from '../../three/StaticCoin';

const ICONS = [LockKeyhole, Smartphone, FolderKanban, BarChart3, PiggyBank];

/** ภาพนิ่งของแต่ละขั้น (ไม่มี WebGL / ลดการเคลื่อนไหว / ระหว่างโหลดฉาก 3D) */
export function TutorialFallback({ step }: { step: number }) {
  const Icon = ICONS[step] ?? PiggyBank;
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <StaticCoin className="absolute h-3/4 w-3/4 opacity-25" />
      <div className="glass relative flex h-28 w-28 items-center justify-center rounded-3xl shadow-[0_0_60px_-10px] shadow-accent/70">
        <Icon size={48} className="text-accent-soft" aria-hidden />
      </div>
    </div>
  );
}
