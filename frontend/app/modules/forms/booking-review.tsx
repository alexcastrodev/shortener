import { Fragment, useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { BioTheme } from '../bio-page/themes';
import { formatCurrency } from '../../i18n/format';
import { dayText, monthlyText } from './booking-bar';
import { durationText, endTime, hasSeveralDurations } from './booking-options.ts';
import type { AllSummary } from './booking-summary.ts';
import { useDurationWords } from './use-duration-words.ts';
import { usePlanWords } from './use-plan-words.ts';

export function BookingReview({
  summary,
  theme,
  onChange,
}: {
  summary: AllSummary;
  theme: BioTheme;
  onChange: () => void;
}) {
  const { t } = useTranslation('respond');
  const words = useDurationWords();
  const plan = usePlanWords();
  const id = useId();
  const several = summary.items.length > 1;
  const money = (amount: number | null, currency: string | null) =>
    amount !== null && currency ? formatCurrency(amount, currency) : null;

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
      {summary.items.map(({ service, summary: item }) => (
        <Fragment key={service.id}>
          <p className="text-sm opacity-80">
            {service.name}
            {' · '}
            {item.kind === 'monthly'
              ? t('booking_mode_monthly')
              : t('booking_review_days', { count: item.count })}
          </p>
          {item.kind === 'monthly' && !item.allowance ? (
            <p className="text-[15px]">
              {monthlyText(item, plan.sessions)}
              {' · '}
              {durationText(item.sessions[0].duration, words)}
            </p>
          ) : (
            <ul className="space-y-1.5 text-[15px]">
              {item.sessions.map(session => (
                <li
                  key={`${session.date}-${session.time}`}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span>
                    {dayText(session.date)} · {session.time}–
                    {endTime(session.time, session.duration)} ·{' '}
                    {durationText(session.duration, words)}
                  </span>
                  {hasSeveralDurations(service) &&
                    money(session.price, item.currency) && (
                      <span className="shrink-0 font-semibold">
                        {money(session.price, item.currency)}
                      </span>
                    )}
                </li>
              ))}
            </ul>
          )}
          {item.allowance && (
            <p className="text-sm opacity-80">
              {plan.counter(item.allowance, item.count)}
            </p>
          )}
        </Fragment>
      ))}
      {several && money(summary.total, summary.currency) && (
        <p className="flex items-baseline justify-between gap-3 border-t border-current/15 pt-3 text-[15px] font-semibold">
          <span>{t('bar_total')}</span>
          <span>{money(summary.total, summary.currency)}</span>
        </p>
      )}
    </div>
  );
}
