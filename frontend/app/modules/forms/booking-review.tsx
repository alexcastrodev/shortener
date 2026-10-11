import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { BioTheme } from '../bio-page/themes';
import { formatCurrency } from '../../i18n/format';
import { dayText, monthlyText } from './booking-bar';
import { durationText, endTime } from './booking-options.ts';
import type { BookingSummary } from './booking-summary.ts';
import { useDurationWords } from './use-duration-words.ts';

export function BookingReview({
  summary,
  serviceName,
  showPrices,
  theme,
  onChange,
}: {
  summary: BookingSummary;
  serviceName: string;
  showPrices: boolean;
  theme: BioTheme;
  onChange: () => void;
}) {
  const { t } = useTranslation('respond');
  const words = useDurationWords();
  const id = useId();
  const money = (amount: number | null) =>
    amount !== null && summary.currency
      ? formatCurrency(amount, summary.currency)
      : null;

  return (
    <div
      role="group"
      aria-labelledby={`${id}-title`}
      className="mt-8 space-y-3 rounded-xl border border-current/20 p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p id={`${id}-title`} className="text-base font-semibold">
          {t('booking_summary')}
        </p>
        <button
          type="button"
          className={`min-h-11 px-2 text-sm underline ${theme.footer}`}
          onClick={onChange}
        >
          {t('booking_review_change')}
        </button>
      </div>
      <p className="text-sm opacity-80">
        {serviceName}
        {' · '}
        {summary.kind === 'monthly'
          ? t('booking_mode_monthly')
          : t('booking_review_days', { count: summary.count })}
      </p>
      {summary.kind === 'monthly' ? (
        <p className="text-[15px]">
          {monthlyText(summary)}
          {' · '}
          {durationText(summary.sessions[0].duration, words)}
        </p>
      ) : (
        <ul className="space-y-1.5 text-[15px]">
          {summary.sessions.map(session => (
            <li
              key={`${session.date}-${session.time}`}
              className="flex items-baseline justify-between gap-3"
            >
              <span>
                {dayText(session.date)} · {session.time}–
                {endTime(session.time, session.duration)} ·{' '}
                {durationText(session.duration, words)}
              </span>
              {showPrices && money(session.price) && (
                <span className="shrink-0 font-semibold">
                  {money(session.price)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
