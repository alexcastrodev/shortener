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
    error: 'bg-red-900/30 border-red-800 text-red-300',
    warning: 'bg-yellow-900/30 border-yellow-800 text-yellow-300',
    info: 'bg-blue-900/30 border-blue-800 text-blue-300',
    success: 'bg-green-900/30 border-green-800 text-green-300',
  };

  return (
    <div
      className={cn('border rounded-lg p-6', variantStyles[variant], className)}
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
