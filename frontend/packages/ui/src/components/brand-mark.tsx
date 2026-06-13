import { IconLink } from '@tabler/icons-react';
import type { AnchorHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

interface BrandMarkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  compact?: boolean;
}

export function BrandMark({
  className,
  compact = false,
  href = '/',
  ...props
}: BrandMarkProps) {
  return (
    <a
      href={href}
      className={cn(
        'inline-flex items-center gap-2 text-foreground no-underline',
        className
      )}
      {...props}
    >
      <span className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-card text-primary shadow-sm">
        <IconLink size={18} stroke={2} />
      </span>
      {!compact && <span className="text-lg font-semibold">Kurz</span>}
    </a>
  );
}
