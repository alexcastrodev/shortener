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
    violet: 'bg-violet-600/20 text-violet-400',
    blue: 'bg-blue-600/20 text-blue-400',
    red: 'bg-red-600/20 text-red-400',
    yellow: 'bg-yellow-600/20 text-yellow-400',
    green: 'bg-green-600/20 text-green-400',
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
