import { getIcon } from '../../lib/icons';

interface Props {
  icon: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 'h-8 w-8 rounded-lg', md: 'h-10 w-10 rounded-xl', lg: 'h-12 w-12 rounded-2xl' };
const ICON = { sm: 16, md: 18, lg: 22 };

/** ไอคอนหมวดหมู่ในกรอบสีอ่อน */
export function CategoryIcon({ icon, color, size = 'md' }: Props) {
  const Icon = getIcon(icon);
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center ${SIZES[size]}`}
      style={{ background: `${color}22`, color, boxShadow: `inset 0 0 0 1px ${color}33` }}
    >
      <Icon size={ICON[size]} strokeWidth={2} />
    </span>
  );
}
