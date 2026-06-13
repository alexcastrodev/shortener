import type { PropsWithChildren, ReactNode } from 'react';
import { cn } from '../utils/cn';

interface AlertProps extends PropsWithChildren {
  variant?: 'error' | 'warning' | 'info' | 'success';
  icon?: ReactNode;
  title?: string;
  className?: string;
}

/**
 * Alert component for error messages, warnings, and notifications
 */
export function Alert({
  children,
  variant = 'error',
  icon,
  title,
  className,
}: AlertProps) {
  const variantStyles = {
    error:
      'border-destructive/30 bg-destructive/10 text-destructive dark:text-red-200',
    warning:
      'border-yellow-500/30 bg-yellow-500/10 text-yellow-900 dark:text-yellow-100',
    info: 'border-primary/25 bg-primary/10 text-primary',
    success:
      'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  };

  return (
    <div
      className={cn('rounded-lg border p-5', variantStyles[variant], className)}
    >
      <div className="flex items-center gap-3">
        {icon && <div className="flex-shrink-0">{icon}</div>}
        <div className="flex-1">
          {title && <h3 className="font-semibold text-lg mb-1">{title}</h3>}
          {typeof children === 'string' ? (
            <p className="text-sm">{children}</p>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
