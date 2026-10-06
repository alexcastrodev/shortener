import {
  IconArrowRight,
  IconBan,
  IconBell,
  IconCalendarRepeat,
  IconGripVertical,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

function Step({
  number,
  title,
  body,
  children,
}: {
  number: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-5 rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
      <span className="font-mono text-xs font-medium tracking-widest text-primary">
        {number}
      </span>
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground">
          {title}
        </h3>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{body}</p>
      </div>
      <div aria-hidden="true" className="mt-auto">
        {children}
      </div>
    </li>
  );
}

function FieldRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground">
      <IconGripVertical size={14} className="text-muted-foreground" />
      {label}
    </div>
  );
}

function Slot({ time, state }: { time: string; state: 'free' | 'picked' | 'full' }) {
  const style = {
    free: 'border-border bg-background/60 text-foreground',
    picked: 'border-primary bg-primary text-primary-foreground',
    full: 'border-border bg-background/30 text-muted-foreground line-through',
  }[state];
  return (
    <span className={`rounded-lg border px-3 py-1.5 font-mono text-xs ${style}`}>
      {time}
    </span>
  );
}

const WEEK = [
  [1, 0, 2],
  [0, 2, 1],
  [2, 1, 0],
  [1, 2, 0],
  [0, 1, 2],
];

export function BookingSteps() {
  const { t } = useTranslation('landing');

  return (
    <section
      id="forms"
      className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
    >
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <p className="font-mono text-xs font-medium tracking-widest text-primary uppercase">
          {t('fm_kicker')}
        </p>
        <h2 className="landing-gradient-text mt-3 font-display text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
          {t('fm_title')}
        </h2>
        <p className="mt-5 text-base leading-7 text-balance text-muted-foreground sm:text-lg">
          {t('fm_lead')}
        </p>
      </div>

      <ol className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        <Step number="01" title={t('fm_step1_title')} body={t('fm_step1_body')}>
          <div className="space-y-2">
            <FieldRow label={t('fm_mock_name')} />
            <FieldRow label={t('fm_mock_email')} />
            <FieldRow label={t('fm_mock_booking')} />
          </div>
        </Step>
        <Step number="02" title={t('fm_step2_title')} body={t('fm_step2_body')}>
          <div className="rounded-xl border border-border bg-background/40 p-4">
            <p className="text-sm font-medium text-foreground">
              {t('fm_mock_service')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Slot time="08:00" state="full" />
              <Slot time="12:30" state="picked" />
              <Slot time="19:00" state="free" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t('fm_mock_spots', { count: 3 })}
            </p>
          </div>
        </Step>
        <Step number="03" title={t('fm_step3_title')} body={t('fm_step3_body')}>
          <div className="grid h-32 grid-cols-5 gap-1.5 rounded-xl border border-border bg-background/40 p-2">
            {WEEK.map((column, day) => (
              <div key={day} className="flex flex-col gap-1.5">
                {column.map((kind, row) =>
                  kind === 0 ? (
                    <span key={row} className="flex-1" />
                  ) : (
                    <span
                      key={row}
                      className={`flex-1 rounded-md border ${kind === 1 ? 'border-primary/50 bg-primary/20' : 'border-dashed border-primary/50 bg-primary/10'}`}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </Step>
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-6 rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
        <div className="min-w-[240px] flex-1">
          <h3 className="font-display text-lg font-semibold text-foreground">
            {t('fm_notices_title')}
          </h3>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            {t('fm_notices_body')}
          </p>
        </div>
        <ul className="flex flex-wrap gap-2 text-sm">
          <li className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-foreground">
            <IconBell size={15} className="text-primary" />
            {t('fm_notice_reminder')}
          </li>
          <li className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-foreground">
            <IconCalendarRepeat size={15} className="text-primary" />
            {t('fm_notice_moved')}
          </li>
          <li className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-foreground">
            <IconBan size={15} className="text-destructive" />
            {t('fm_notice_cancelled')}
          </li>
        </ul>
      </div>

      <div className="mt-10 text-center">
        <a
          href="/app/forms"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          {t('fm_cta')}
          <IconArrowRight size={18} />
        </a>
      </div>
    </section>
  );
}
