import { ArrowLeftRight, ChartPie, LayoutDashboard, Settings, Target, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

// ทุกหน้าของแอปอยู่ใต้ /app (หน้า "/" เป็น Landing Page สาธารณะ)
export const NAV: NavItem[] = [
  { to: '/app', label: 'ภาพรวม', icon: LayoutDashboard },
  { to: '/app/transactions', label: 'รายการ', icon: ArrowLeftRight },
  { to: '/app/analytics', label: 'วิเคราะห์', icon: ChartPie },
  { to: '/app/budget', label: 'งบ & เป้าหมาย', icon: Target },
  { to: '/app/settings', label: 'ตั้งค่า', icon: Settings },
];
