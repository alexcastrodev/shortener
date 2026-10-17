import type { PropsWithChildren } from 'react';
import { cn } from '../utils/cn';

interface LoadingProps extends PropsWithChildren {
  loading: boolean;
  label: string;
  className?: string;
}

export function Loading({ loading, label, className, children }: LoadingProps) {
  return (
    <>
      {loading && (
        <p
          role="status"
          className="flex items-center gap-2 text-[15px] font-semibold"
        >
          <span
            aria-hidden="true"
            className="h-4 w-4 shrink-0 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
          />
          {label}
        </p>
      )}
      <div
        aria-busy={loading}
        className={cn(loading && 'motion-safe:animate-pulse', className)}
      >
        {children}
      </div>
    </>
  );
}
