import type { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '../utils/cn';

interface CardProps extends PropsWithChildren<HTMLAttributes<HTMLDivElement>> {
  variant?: 'default' | 'error' | 'warning';
}

export function Card({
  children,
  className,
  variant = 'default',
  ...props
}: CardProps) {
  const baseStyles = 'rounded-lg backdrop-blur-xl shadow-lg';

  const variantStyles = {
    default: 'bg-zinc-900/50 border border-zinc-800',
    error: 'bg-red-900/30 border border-red-800',
    warning: 'bg-yellow-900/30 border border-yellow-800',
  };

  return (
    <div
      className={cn(baseStyles, variantStyles[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={cn('mb-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardContent({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={cn('p-6', className)} {...props}>
      {children}
    </div>
  );
}

interface CardTitleProps
  extends PropsWithChildren<HTMLAttributes<HTMLHeadingElement>> {
  icon?: React.ReactNode;
}

export function CardTitle({
  children,
  icon,
  className,
  ...props
}: CardTitleProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {icon && <div className="text-violet-400">{icon}</div>}
      <h2 className="text-xl font-semibold text-white" {...props}>
        {children}
      </h2>
    </div>
  );
}

export function CardDescription({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLParagraphElement>>) {
  return (
    <p className={cn('text-sm text-zinc-400 mt-2', className)} {...props}>
      {children}
    </p>
  );
}
