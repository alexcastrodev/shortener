import {
  IconBrandGithub,
  IconCalendarTime,
  IconChartBar,
  IconCheck,
  IconGift,
  IconLock,
  IconShieldCheck,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SpotlightCard } from './spotlight-card';

function CardTitle({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg border border-border bg-background/60 text-primary">
        {icon}
      </div>
      <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}

const CHART = [12, 18, 15, 26, 22, 34, 30, 44, 39, 52, 48, 63];

function AnalyticsChart() {
  const max = Math.max(...CHART);
  const points = CHART.map((value, index) => [
    (index / (CHART.length - 1)) * 100,
    40 - (value / max) * 34,
  ]);
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`).join(' ');

  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-36 w-full" aria-hidden="true">
      <defs>
        <linearGradient id="bento-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--app-primary)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--app-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100,40 L0,40 Z`} fill="url(#bento-area)" />
      <path
        d={line}
        pathLength={1}
        className="landing-draw"
        fill="none"
        stroke="var(--app-primary)"
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Countdown() {
  const { t } = useTranslation('landing');
  // Fixed on the server; ticks down after hydration.
  const [seconds, setSeconds] = useState(2 * 3600 + 14 * 60 + 9);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = setInterval(() => setSeconds(value => (value > 0 ? value - 1 : 0)), 1000);
    return () => clearInterval(interval);
  }, []);

  const pad = (value: number) => String(value).padStart(2, '0');
  const time = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;

  return (
    <div className="rounded-lg border border-border bg-background/60 px-4 py-3">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {t('fb_countdown')}
      </p>
      <p className="font-mono text-2xl font-semibold tabular-nums">{time}</p>
    </div>
  );
}

export function FeatureBento() {
  const { t } = useTranslation('landing');
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <SpotlightCard className="md:col-span-2">
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:items-end">
          <CardTitle icon={<IconChartBar size={20} />} title={t('fb_analytics_title')}>
            {t('fb_analytics_body')}
          </CardTitle>
          <div>
            <AnalyticsChart />
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {['iOS 48%', 'Android 31%', `${t('fb_desktop')} 21%`].map(label => (
                <span key={label} className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </SpotlightCard>

      <SpotlightCard>
        <CardTitle icon={<IconShieldCheck size={20} />} title={t('fb_safety_title')}>
          {t('fb_safety_body')}
        </CardTitle>
        <ul className="mt-5 space-y-2 font-mono text-xs">
          <li className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="truncate">example.com/summer</span>
            <IconCheck size={15} className="shrink-0 text-primary" />
          </li>
          <li className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="truncate">docs.example.com</span>
            <IconCheck size={15} className="shrink-0 text-primary" />
          </li>
          <li className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
            <span className="truncate">free-prize.example</span>
            <IconAlertTriangle size={15} className="shrink-0" />
          </li>
        </ul>
      </SpotlightCard>

      <SpotlightCard>
        <CardTitle icon={<IconLock size={20} />} title={t('fb_password_title')}>
          {t('fb_password_body')}
        </CardTitle>
        <div className="mt-5 flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2.5">
          <IconLock size={15} className="text-muted-foreground" />
          <span className="font-mono tracking-[0.3em] text-foreground">••••••</span>
          <span className="ml-auto rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
            {t('fb_unlock')}
          </span>
        </div>
      </SpotlightCard>

      <SpotlightCard>
        <CardTitle icon={<IconCalendarTime size={20} />} title={t('fb_expire_title')}>
          {t('fb_expire_body')}
        </CardTitle>
        <div className="mt-5">
          <Countdown />
        </div>
      </SpotlightCard>

      <SpotlightCard>
        <CardTitle icon={<IconGift size={20} />} title={t('fb_free_title')}>
          {t('fb_free_body')}
        </CardTitle>
        <p className="landing-gradient-text mt-4 font-display text-6xl font-semibold tracking-tight">
          $0
        </p>
      </SpotlightCard>

      <SpotlightCard className="md:col-span-3">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:items-center">
          <CardTitle icon={<IconBrandGithub size={20} />} title={t('fb_oss_title')}>
            {t('fb_oss_body')}
          </CardTitle>
          <pre className="overflow-x-auto rounded-lg border border-border bg-background/80 p-4 font-mono text-xs leading-6 sm:text-sm">
            <code>
              <span className="text-muted-foreground">$ </span>git clone https://github.com/alexcastrodev/shortner{'\n'}
              <span className="text-muted-foreground">$ </span>cd shortner{'\n'}
              <span className="text-muted-foreground">{t('fb_license_comment')}</span>
            </code>
          </pre>
        </div>
      </SpotlightCard>
    </div>
  );
}
