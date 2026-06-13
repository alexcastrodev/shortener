import type { PropsWithChildren } from 'react';
import { cn } from '../utils/cn';

interface PageBackgroundProps extends PropsWithChildren {
  className?: string;
}

export function PageBackground({ children, className }: PageBackgroundProps) {
  return (
    <div
      className={cn(
        'min-h-screen bg-background text-foreground',
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageContainer({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8',
        className
      )}
    >
      {children}
    </div>
  );
}
