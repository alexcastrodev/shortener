import type { PropsWithChildren } from 'react';
import { usePointerTilt } from './use-pointer-tilt';

interface SpotlightCardProps {
  className?: string;
}

// Bento card: a light follows the pointer and the card tilts slightly in 3D.
export function SpotlightCard({
  children,
  className = '',
}: PropsWithChildren<SpotlightCardProps>) {
  const { ref, onPointerMove, onPointerLeave } = usePointerTilt<HTMLDivElement>(4);

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{
        transform:
          'perspective(1200px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))',
      }}
      className={`spotlight-card overflow-hidden rounded-2xl border border-border bg-card/60 p-6 backdrop-blur transition-[transform,border-color] duration-300 ease-out hover:border-primary/40 ${className}`}
    >
      {children}
    </div>
  );
}
