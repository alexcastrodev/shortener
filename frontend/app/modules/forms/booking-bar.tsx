import { useTranslation } from 'react-i18next';
import type { BioTheme } from '../bio-page/themes';
import { formatCurrency, formatDate } from '../../i18n/format';
import type { AllSummary, BookingSummary } from './booking-summary.ts';
import { usePlanWords } from './use-plan-words.ts';

export const dayText = (iso: string) =>
  formatDate(`${iso}T00:00:00Z`, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

const weekdayText = (iso: string) =>
  formatDate(`${iso}T00:00:00Z`, { weekday: 'short', timeZone: 'UTC' });

const mondayFirst = (iso: string) =>
  (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;

export function monthlyText(
  summary: BookingSummary,
  sessions: (count: number) => string
) {
  const first = summary.sessions[0];
  if (!first) return '';
  const month = formatDate(`${first.date.slice(0, 7)}-01T00:00:00Z`, {
    month: 'long',
    timeZone: 'UTC',
  });
  if (summary.allowance) return `${month} · ${sessions(summary.count)}`;
  const weekdays = [
    ...new Map(summary.sessions.map(item => [mondayFirst(item.date), item.date])),
  ]
    .sort(([a], [b]) => a - b)
    .map(([, date]) => weekdayText(date));
  return `${month} · ${weekdays.join(', ')} · ${first.time}`;
}

export function daysText(summary: BookingSummary) {
  const byDay = new Map<string, string[]>();
  for (const item of summary.sessions)
    byDay.set(item.date, [...(byDay.get(item.date) ?? []), item.time]);
  return [...byDay]
    .map(([date, times]) => `${dayText(date)} · ${times.join(', ')}`)
    .join('  ·  ');
}

export function BookingBar({
  summary,
  currency,
  monthly,
  theme,
  label,
  ready,
  unfinished = [],
  onSubmit,
}: {
  summary: AllSummary | null;
  currency: string | null;
  monthly: boolean;
  theme: BioTheme;
  label: string;
  ready: boolean;
  unfinished?: string[];
  onSubmit: () => void;
}) {
  const { t } = useTranslation('respond');
  const plan = usePlanWords();
  const total = summary ? summary.total : currency ? 0 : null;
  const shownCurrency = summary?.currency ?? currency;
  const only: BookingSummary | null =
    summary?.items.length === 1 ? summary.items[0].summary : null;

  return (
    <div className="sticky bottom-0 z-10 mt-auto">
      <div className="flex items-center gap-4 rounded-t-xl border border-b-0 border-current/20 bg-current/10 px-4 py-3 backdrop-blur-xl">
        <div className="min-w-0 flex-1" aria-live="polite">
          <p
            className={`truncate text-sm font-semibold ${summary ? '' : 'opacity-70'}`}
          >
            {!summary
              ? t('bar_none')
              : !only
                ? summary.items.map(({ service }) => service.name).join(', ')
                : only.kind === 'monthly'
                  ? monthlyText(only, plan.sessions)
                  : daysText(only)}
          </p>
          <p className="truncate text-xs opacity-70">
            {unfinished.length > 0
              ? t('bar_unfinished', { names: unfinished.join(', ') })
              : !summary
              ? t(monthly ? 'bar_hint' : 'bar_hint_days')
              : !only
                ? t('bar_services', {
                    total: summary.count,
                    services: summary.items.length,
                  })
                : only.allowance
                  ? plan.counter(only.allowance, only.count)
                  : only.kind === 'monthly'
                    ? t('bar_monthly', { count: only.count })
                    : t('bar_sessions', { count: only.count })}
          </p>
        </div>
        {total !== null && shownCurrency && (
          <div className="flex flex-col items-end">
            <span className="text-xs opacity-70">{t('bar_total')}</span>
            <span className="text-xl font-semibold">
              {formatCurrency(total, shownCurrency)}
            </span>
          </div>
        )}
        <button
          type="button"
          aria-disabled={!ready}
          className={`min-h-12 rounded-lg px-6 py-2 text-[15px]! font-semibold! ${theme.button} ${ready ? '' : 'cursor-not-allowed opacity-60'}`}
          onClick={onSubmit}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
