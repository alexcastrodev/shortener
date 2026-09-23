import { IconChartBar, IconLink, IconQrcode } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import type { PublicPage } from '@internal/core/types/Page';
import { BioPageView } from './bio-page-view';
import { illustratedAvatar } from './illustrated-avatar';
import { PhoneFrame } from './phone-frame';
import { usePointerTilt } from '../landing/use-pointer-tilt';

type SamplePage = Pick<
  PublicPage,
  'slug' | 'display_title' | 'bio' | 'theme' | 'avatar_url' | 'links'
>;

const links = (...labels: string[]) =>
  labels.map((label, index) => ({
    id: index + 1,
    kind: 'link' as const,
    label,
    url: '#',
    icon: null,
  }));

const social = (id: number, icon: string) => ({
  id,
  kind: 'social' as const,
  label: icon,
  url: '#',
  icon,
});

const FRONT: SamplePage = {
  slug: 'marina',
  display_title: 'Marina Costa',
  bio: 'Ceramics and slow mornings. New pieces every month.',
  theme: 'sunset',
  avatar_url: illustratedAvatar({
    background: ['#fed7aa', '#fb923c'],
    skin: '#f1c9a5',
    hair: '#7c2d12',
    shirt: '#9a3412',
  }),
  links: [
    social(10, 'instagram'),
    social(11, 'tiktok'),
    social(12, 'whatsapp'),
    ...links('Shop the latest collection', 'Workshop dates'),
    { id: 20, kind: 'header' as const, label: 'Press', url: null, icon: null },
    { id: 21, kind: 'link' as const, label: 'Featured on YouTube', url: '#', icon: 'youtube' },
  ],
};

const LEFT: SamplePage = {
  slug: 'studionord',
  display_title: 'Studio Nord',
  bio: 'Brand and type design from Porto.',
  theme: 'midnight',
  avatar_url: illustratedAvatar({
    background: ['#818cf8', '#4338ca'],
    skin: '#e0ac86',
    hair: '#1e1b4b',
    shirt: '#312e81',
  }),
  links: links('Portfolio', 'Case studies', 'Book a call'),
};

const RIGHT: SamplePage = {
  slug: 'rafa',
  display_title: 'Rafa Lima',
  bio: 'Running coach. Plans for your first 10k.',
  theme: 'forest',
  avatar_url: illustratedAvatar({
    background: ['#bbf7d0', '#22c55e'],
    skin: '#8d5a3b',
    hair: '#14532d',
    shirt: '#166534',
  }),
  links: links('Training plans', 'Strava club', 'Race calendar'),
};

// Deterministic QR-like pattern: decorative only, it does not encode data.
function QrPattern() {
  const size = 21;
  const cells: Array<[number, number]> = [];
  let seed = 7;
  const inFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inFinder(x, y)) continue;
      seed = (seed * 1103515245 + 12345) % 2147483648;
      if (seed % 5 < 2) cells.push([x, y]);
    }
  }

  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" fill="currentColor" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="white" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="currentColor" />
    </g>
  );

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full text-neutral-900">
      <rect width={size} height={size} fill="white" />
      {finder(0, 0)}
      {finder(14, 0)}
      {finder(0, 14)}
      {cells.map(([x, y]) => (
        <rect key={`${x}:${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
      ))}
    </svg>
  );
}

const chip =
  'rounded-xl border border-border bg-card/90 text-card-foreground shadow-xl backdrop-blur-md';

// The tap animation (landing-tap) repeats every 3s; the counter follows it.
function useTapCounter(start: number) {
  const [clicks, setClicks] = useState(start);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = setInterval(() => setClicks(value => value + 1), 3000);
    return () => clearInterval(interval);
  }, []);

  return clicks;
}

// Homepage illustration for bio pages: three sample pages in different
// themes on a 3D stage that tilts with the pointer, fanning out as it
// scrolls into view, plus what comes with every page (short address,
// clicks per link, QR code). Decorative; described by one aria-label.
export function BioShowcase() {
  const clicks = useTapCounter(342);
  const { ref, onPointerMove, onPointerLeave } = usePointerTilt<HTMLDivElement>(10);

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      role="img"
      aria-label="Three example bio pages in different themes, with a short page address, click counts per link and a QR code"
      className="bio-stage relative mx-auto h-[520px] w-full max-w-[600px] sm:h-[600px]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-10 top-16 bottom-10 rounded-full bg-primary/30 blur-3xl"
      />

      <div aria-hidden="true" className="bio-stage-inner absolute inset-0">
        <div className="absolute inset-x-0 top-8 hidden justify-center [transform-style:preserve-3d] sm:flex">
          <div className="bio-phone-left w-[230px]">
            <PhoneFrame screenClassName="h-[440px]">
              <BioPageView page={LEFT} preview />
            </PhoneFrame>
          </div>
        </div>

        <div className="absolute inset-x-0 top-8 hidden justify-center [transform-style:preserve-3d] sm:flex">
          <div className="bio-phone-right w-[230px]">
            <PhoneFrame screenClassName="h-[440px]">
              <BioPageView page={RIGHT} preview />
            </PhoneFrame>
          </div>
        </div>

        <div className="absolute inset-x-0 top-0 flex justify-center [transform-style:preserve-3d]">
          <div className="bio-phone-front w-[260px]">
            <PhoneFrame screenClassName="h-[480px] sm:h-[520px]">
              <BioPageView page={FRONT} preview pulseLinkId={1} />
            </PhoneFrame>
          </div>
        </div>

        <div className="bio-float-layer pointer-events-none absolute inset-0">
          <div className="absolute top-6 left-0 sm:top-10 sm:left-2">
            <div className={`${chip} landing-float flex items-center gap-2 px-3 py-2`}>
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <IconLink size={15} stroke={2} />
              </span>
              <span className="font-mono text-sm font-semibold">kurz.fyi/u/marina</span>
            </div>
          </div>

          <div className="absolute right-0 bottom-12 sm:right-0 sm:bottom-24">
            <div className={`${chip} landing-float-delayed w-52 p-3`}>
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <IconChartBar size={14} />
                Shop the latest collection
              </div>
              <div className="mt-1 flex items-end justify-between gap-3">
                <span className="font-display text-xl font-semibold tabular-nums">
                  {clicks} clicks
                </span>
                <span className="flex h-8 items-end gap-1">
                  {[35, 55, 40, 70, 60, 85, 100].map((height, index) => (
                    <span
                      key={index}
                      className="w-1.5 rounded-sm bg-primary"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">this week</div>
            </div>
          </div>

          <div className="absolute bottom-8 left-4 hidden sm:block">
            <div className={`${chip} landing-float flex items-center gap-3 p-2.5 pr-4`}>
              <span className="size-14 overflow-hidden rounded-md">
                <QrPattern />
              </span>
              <span>
                <span className="flex items-center gap-1 text-sm font-semibold">
                  <IconQrcode size={15} />
                  QR code
                </span>
                <span className="text-xs text-muted-foreground">Print it, scan it.</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
