import { useTranslation } from 'react-i18next';
import type { BioTheme } from '../bio-page/themes';
import { formatDate } from '../../i18n/format';
import {
  canGoNext,
  canGoPrev,
  dayCell,
  isoDay,
  monthGrid,
  shiftMonth,
} from './booking-calendar.ts';

const fullDay = (iso: string) =>
  formatDate(`${iso}T00:00:00Z`, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

export function BookingCalendar({
  month,
  today,
  available,
  chosen,
  viewed,
  theme,
  onView,
  onMonth,
}: {
  month: string;
  today: Date;
  available: Set<string>;
  chosen: Map<string, string>;
  viewed: string | undefined;
  theme: BioTheme;
  onView: (iso: string) => void;
  onMonth: (month: string) => void;
}) {
  const { t } = useTranslation('respond');
  const todayIso = isoDay(today);
  const names = [
    t('monthly_day_mon'),
    t('monthly_day_tue'),
    t('monthly_day_wed'),
    t('monthly_day_thu'),
    t('monthly_day_fri'),
    t('monthly_day_sat'),
    t('monthly_day_sun'),
  ];
  const nav = `h-10 w-10 rounded-lg text-lg disabled:opacity-40 ${theme.button}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className={nav}
          aria-label={t('booking_prev_month')}
          disabled={!canGoPrev(month, today)}
          onClick={() => onMonth(shiftMonth(month, -1))}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <p aria-live="polite" className="text-[15px] font-semibold first-letter:uppercase">
          {formatDate(`${month}-01T00:00:00Z`, {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          })}
        </p>
        <button
          type="button"
          className={nav}
          aria-label={t('booking_next_month')}
          disabled={!canGoNext(month, today)}
          onClick={() => onMonth(shiftMonth(month, 1))}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <table className="w-full table-fixed border-separate border-spacing-0.5">
        <thead>
          <tr>
            {names.map(name => (
              <th
                key={name}
                scope="col"
                className="pb-1 text-xs font-normal opacity-70"
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(month).map(week => (
            <tr key={week.find(Boolean)}>
              {week.map((iso, index) => {
                if (!iso) return <td key={index} />;
                const cell = dayCell(iso, {
                  available,
                  chosen,
                  viewed,
                  todayIso,
                });
                const label = fullDay(iso);
                return (
                  <td key={iso} className="p-0">
                    <button
                      type="button"
                      disabled={!cell.enabled}
                      aria-pressed={cell.viewed}
                      aria-current={cell.today ? 'date' : undefined}
                      aria-label={
                        cell.time
                          ? t('booking_day_chosen', {
                              date: label,
                              time: cell.time,
                            })
                          : label
                      }
                      onClick={() => onView(iso)}
                      className={`flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-lg text-sm! ${
                        cell.time
                          ? 'border border-current bg-current/25 font-semibold!'
                          : cell.enabled
                            ? `font-semibold! ${theme.button}`
                            : 'cursor-default font-normal! opacity-40'
                      } ${cell.viewed ? 'ring-2 ring-current' : ''} ${
                        cell.today ? 'underline' : ''
                      }`}
                    >
                      {Number(iso.slice(8))}
                      {cell.time ? (
                        <span
                          aria-hidden="true"
                          className="font-mono text-[10px] leading-none font-semibold no-underline"
                        >
                          {cell.time}
                        </span>
                      ) : (
                        cell.enabled && (
                          <span
                            aria-hidden="true"
                            className="h-1 w-1 rounded-full bg-current"
                          />
                        )
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul
        aria-label={t('booking_legend')}
        className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs opacity-80"
      >
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 rounded border border-current bg-current/25"
          />
          {t('booking_legend_chosen')}
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 rounded ring-2 ring-inset ring-current"
          />
          {t('booking_legend_viewed')}
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="flex h-3.5 w-3.5 items-center justify-center rounded border border-current/40"
          >
            <span className="h-1 w-1 rounded-full bg-current" />
          </span>
          {t('booking_legend_free')}
        </li>
      </ul>
    </div>
  );
}
