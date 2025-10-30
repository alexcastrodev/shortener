import type { PropsWithChildren } from 'react';
import { cn } from '../utils/cn';

interface PageBackgroundProps extends PropsWithChildren {
  className?: string;
}

export function PageBackground({ children, className }: PageBackgroundProps) {
  return (
    <div
      className={cn(
        'min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white relative overflow-hidden',
        className
      )}
    >
      <div className="fixed inset-0 opacity-10 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(124,58,237,0.3) 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="fixed inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/50 pointer-events-none" />

      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function PageContainer({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn('max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12', className)}
    >
      {children}
    </div>
  );
}
