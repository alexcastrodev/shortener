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
  const baseStyles = 'rounded-lg border shadow-sm';

  const variantStyles = {
    default: 'border-border bg-card text-card-foreground',
    error:
      'border-destructive/30 bg-destructive/10 text-destructive dark:text-red-200',
    warning:
      'border-yellow-500/30 bg-yellow-500/10 text-yellow-900 dark:text-yellow-100',
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
      {icon && <div className="text-primary">{icon}</div>}
      <h2 className="text-xl font-semibold text-foreground" {...props}>
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
    <p className={cn('mt-2 text-sm text-muted-foreground', className)} {...props}>
      {children}
    </p>
  );
}
