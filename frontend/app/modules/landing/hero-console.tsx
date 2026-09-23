import { IconCopy, IconShieldCheck } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { usePointerTilt } from './use-pointer-tilt';

const SAMPLES = [
  { url: 'https://example.com/campaigns/summer-launch/2026?utm_source=newsletter', code: 'x7f2A' },
  { url: 'https://shop.example.com/collections/ceramics/handmade-mugs-set-of-4', code: 'Mg4qe' },
  { url: 'https://docs.example.com/guides/getting-started/installation#macos', code: 'd0cS7' },
];

const COUNTRIES = [
  { code: 'BR', share: 42 },
  { code: 'PT', share: 27 },
  { code: 'US', share: 18 },
];

type Phase = 'typing' | 'done';

// The product in one card: a long URL is typed, a short link comes out and
// clicks start arriving. Server render shows the finished first sample; the
// loop starts after hydration (and not at all with reduced motion).
function useShortenLoop() {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(SAMPLES[0].url.length);
  const [phase, setPhase] = useState<Phase>('done');

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let timer: ReturnType<typeof setTimeout>;
    let current = 0;

    const typeSample = (sample: number, count: number) => {
      setIndex(sample);
      setPhase('typing');
      setTyped(count);
      if (count < SAMPLES[sample].url.length) {
        timer = setTimeout(() => typeSample(sample, count + 2), 28);
      } else {
        setPhase('done');
        timer = setTimeout(() => {
          current = (current + 1) % SAMPLES.length;
          typeSample(current, 0);
        }, 3800);
      }
    };

    timer = setTimeout(() => {
      current = 1;
      typeSample(current, 0);
    }, 3200);
    return () => clearTimeout(timer);
  }, []);

  return { sample: SAMPLES[index], typed, phase };
}

function useClickCounter(start: number) {
  const [clicks, setClicks] = useState(start);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = setInterval(() => {
      setClicks(value => value + 1 + Math.floor(Math.random() * 3));
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  return clicks;
}

export function HeroConsole() {
  const { sample, typed, phase } = useShortenLoop();
  const clicks = useClickCounter(1284);
  const { ref, onPointerMove, onPointerLeave } = usePointerTilt<HTMLDivElement>(5);

  return (
    <div className="console-tilt-in">
      <div
        ref={ref}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        style={{
          transform:
            'perspective(1400px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))',
        }}
        className="spotlight-card overflow-hidden rounded-2xl border border-border bg-card/80 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.5)] backdrop-blur-xl transition-transform duration-300 ease-out"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-mono text-xs text-muted-foreground">
            kurz.fyi/app
          </span>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background/70 px-3 py-2.5 font-mono text-xs sm:text-sm">
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {sample.url.slice(0, typed)}
              {phase === 'typing' && (
                <span className="landing-caret ml-px inline-block h-4 w-px translate-y-0.5 bg-foreground" />
              )}
            </span>
            <span className="rounded-md bg-primary px-2.5 py-1 font-sans text-xs font-semibold text-primary-foreground">
              Shorten
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div
              key={sample.code}
              className={`flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-3 ${phase === 'done' ? 'landing-rise' : 'opacity-0'}`}
            >
              <div className="min-w-0">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Your short link
                </p>
                <p className="truncate font-mono text-base font-semibold text-foreground sm:text-lg">
                  kurz.fyi/{sample.code}
                </p>
              </div>
              <IconCopy size={18} className="shrink-0 text-muted-foreground" />
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-3 text-xs text-muted-foreground">
              <IconShieldCheck size={18} className="text-primary" />
              Safe Browsing
              <span className="font-semibold text-foreground">clean</span>
            </div>
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-5 rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Clicks
              </p>
              <p className="font-display text-3xl font-semibold tabular-nums">
                {clicks.toLocaleString('en-US')}
              </p>
            </div>
            <div className="space-y-1.5">
              {COUNTRIES.map(country => (
                <div key={country.code} className="flex items-center gap-2 text-xs">
                  <span className="w-6 font-mono text-muted-foreground">
                    {country.code}
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${country.share}%` }}
                    />
                  </span>
                  <span className="w-8 text-right tabular-nums text-muted-foreground">
                    {country.share}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
