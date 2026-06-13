import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

interface IconBadgeProps {
  icon: ReactNode;
  variant?: 'violet' | 'blue' | 'red' | 'yellow' | 'green';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * IconBadge - Circular badge with icon
 * Used for stat cards, feature highlights
 */
export function IconBadge({
  icon,
  variant = 'violet',
  size = 'md',
  className,
}: IconBadgeProps) {
  const variantStyles = {
    violet: 'bg-primary/10 text-primary',
    blue: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    red: 'bg-destructive/10 text-destructive',
    yellow: 'bg-yellow-500/10 text-yellow-900 dark:text-yellow-100',
    green: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  };

  const sizeStyles = {
    sm: 'p-1.5',
    md: 'p-2.5',
    lg: 'p-4',
  };

  return (
    <div
      className={cn(
        'rounded-lg inline-flex items-center justify-center',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {icon}
    </div>
  );
}
