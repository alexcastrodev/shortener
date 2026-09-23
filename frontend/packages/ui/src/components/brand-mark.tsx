import type { AnchorHTMLAttributes } from 'react';
import { cn } from '../utils/cn';
import { KurzLogo } from './kurz-logo';

interface BrandMarkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  compact?: boolean;
}

// The mark plus the "kurz." wordmark; the round teal period echoes the logo.
export function BrandMark({
  className,
  compact = false,
  href = '/',
  ...props
}: BrandMarkProps) {
  return (
    <a
      href={href}
      aria-label="Kurz"
      className={cn(
        'inline-flex items-center gap-2 text-foreground no-underline',
        className
      )}
      {...props}
    >
      <KurzLogo className="size-8 shrink-0" />
      {!compact && (
        <span className="text-xl font-bold tracking-tight">
          kurz
          <span className="ml-px inline-block size-[0.3em] rounded-full bg-primary align-baseline" />
        </span>
      )}
    </a>
  );
}
