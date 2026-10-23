import type { ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}

export function Card({ title, action, children, className = '', as: Tag = 'section' }: CardProps) {
  return (
    <Tag className={`glass rounded-2xl p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold text-fg">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </Tag>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
