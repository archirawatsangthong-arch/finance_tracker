import {
  Baby, Banknote, Briefcase, Bus, Car, Coffee, Coins, CreditCard, Dumbbell, Film, Fuel, Gamepad2,
  Gift, GraduationCap, HeartPulse, House, Landmark, Laptop, Lightbulb, Music, PawPrint, PiggyBank,
  Pizza, Plane, Receipt, Shirt, ShoppingBag, Smartphone, Sparkles, Stethoscope, Tag, TrainFront,
  TrendingUp, Utensils, Wallet, Zap, type LucideIcon,
} from 'lucide-react';

// รวมไอคอนที่ให้ผู้ใช้เลือกได้ (import เฉพาะที่ใช้ เพื่อให้ bundle เล็ก)
export const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils, coffee: Coffee, pizza: Pizza, car: Car, bus: Bus, train: TrainFront, fuel: Fuel,
  plane: Plane, shopping: ShoppingBag, shirt: Shirt, receipt: Receipt, zap: Zap, lightbulb: Lightbulb,
  house: House, smartphone: Smartphone, gamepad: Gamepad2, film: Film, music: Music,
  health: HeartPulse, stethoscope: Stethoscope, dumbbell: Dumbbell, baby: Baby, pet: PawPrint,
  education: GraduationCap, gift: Gift, briefcase: Briefcase, laptop: Laptop, trending: TrendingUp,
  banknote: Banknote, coins: Coins, card: CreditCard, landmark: Landmark, piggy: PiggyBank,
  wallet: Wallet, sparkles: Sparkles, tag: Tag,
};

export const getIcon = (name: string): LucideIcon => ICONS[name] ?? Tag;

export const PALETTE = [
  '#F59E0B', '#F97316', '#EF4444', '#EC4899', '#D946EF', '#8B5CF6',
  '#6366F1', '#3B82F6', '#06B6D4', '#14B8A6', '#10B981', '#84CC16',
];
