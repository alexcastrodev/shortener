import { useTranslation } from 'react-i18next';
import type { BioTheme } from '../bio-page/themes';
import { formatDate } from '../../i18n/format';
import {
  canGoNext,
  canGoPrev,
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
  chosen: Set<string>;
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
        <p aria-live="polite" className="text-sm font-semibold first-letter:uppercase">
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
                className="pb-1 text-xs font-medium opacity-70"
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
                const enabled = available.has(iso);
                const selected = iso === viewed;
                const label = fullDay(iso);
                return (
                  <td key={iso} className="p-0">
                    <button
                      type="button"
                      disabled={!enabled}
                      aria-pressed={selected}
                      aria-current={iso === todayIso ? 'date' : undefined}
                      aria-label={
                        chosen.has(iso)
                          ? t('booking_day_chosen', { date: label })
                          : label
                      }
                      onClick={() => onView(iso)}
                      className={`relative h-10 w-full rounded-lg text-sm ${
                        enabled
                          ? `font-medium ${theme.button}`
                          : 'cursor-default opacity-40'
                      } ${selected ? 'ring-2 ring-current' : ''} ${
                        iso === todayIso ? 'underline' : ''
                      }`}
                    >
                      {Number(iso.slice(8))}
                      {chosen.has(iso) && (
                        <span
                          aria-hidden="true"
                          className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-current"
                        />
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
