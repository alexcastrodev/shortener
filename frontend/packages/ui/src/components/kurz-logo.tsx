import { useId, type SVGProps } from 'react';

// The Kurz mark: a K whose arms are a ribbon folded back on itself (the top
// arm lighter, the bottom one in shadow). Same drawing as public/favicon.svg,
// but the tile and the stem follow the theme tokens so it sits on any
// background.
export function KurzLogo(props: SVGProps<SVGSVGElement>) {
  // Unique gradient ids: several logos can be on one page, and a hidden one
  // would otherwise break the gradients of the visible ones.
  const id = useId();
  const top = `${id}-top`;
  const bottom = `${id}-bottom`;

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id={top} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7ae0dc" />
          <stop offset="1" stopColor="#2fa9a5" />
        </linearGradient>
        <linearGradient id={bottom} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1f8f8b" />
          <stop offset="1" stopColor="#136e6b" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="var(--app-card)" />
      <rect
        x=".75"
        y=".75"
        width="62.5"
        height="62.5"
        rx="14.25"
        fill="none"
        stroke="var(--app-border)"
        strokeWidth="1.5"
      />
      <rect
        x="14"
        y="13"
        width="10"
        height="38"
        rx="2.5"
        fill="var(--app-foreground)"
      />
      <path d="M27 32H38.5L52 51H40.5Z" fill={`url(#${bottom})`} />
      <path d="M27 32L40.5 13H52L38.5 32Z" fill={`url(#${top})`} />
    </svg>
  );
}
