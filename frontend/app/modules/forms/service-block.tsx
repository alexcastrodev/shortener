import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BookingItem, FormField } from '@internal/core/types/Form';
import type {
  FormSlot,
  LoadedSlots,
} from '@internal/core/actions/get-form-slots/get-form-slots.types';
import type { BioTheme } from '../bio-page/themes';
import { formatCurrency, formatDate } from '../../i18n/format';
import { WaitlistJoin, type JoinWaitlist } from './waitlist-join';
import { BookingCalendar } from './booking-calendar.tsx';
import {
  canGoNext,
  keepFree,
  monthOf,
  monthRange,
  previewSlots,
  shiftMonth,
  toggleSession,
  type PickedSession,
} from './booking-calendar.ts';
import {
  bookingOptions,
  cheapestPrice,
  durationText,
  hasSeveralDurations,
  monthlyMinutes,
} from './booking-options.ts';
import { useDurationWords } from './use-duration-words.ts';
import {
  WEEKDAYS,
  monthOptions,
  monthlyComplete,
  monthlyDates,
  toggleWeekday,
} from './monthly-booking';

export type LoadSlots = (
  service: string,
  from: string,
  to: string
) => Promise<LoadedSlots>;

export const dayLabel = (iso: string) =>
  formatDate(`${iso}T00:00:00Z`, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

const dayHeading = (iso: string) =>
  formatDate(`${iso}T00:00:00Z`, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

type Cache = { key: string; months: Record<string, LoadedSlots> };

type Note = {
  kind: 'saved' | 'removed' | 'overlap';
  date: string;
  time: string;
  duration: number;
  clash?: PickedSession;
};

type Service = NonNullable<FormField['services']>[number];

export function ServiceBlock({
  field,
  service,
  item,
  others,
  onItem,
  theme,
  inputId,
  loadSlots,
  joinWaitlist,
  reloadKey,
  hideSummary,
  multiple,
}: {
  field: FormField;
  service: Service;
  item: BookingItem | undefined;
  others: PickedSession[];
  onItem: (item: BookingItem | undefined) => void;
  theme: BioTheme;
  inputId: string;
  loadSlots?: LoadSlots;
  joinWaitlist?: JoinWaitlist;
  reloadKey?: string;
  hideSummary?: boolean;
  multiple: boolean;
}) {
  const { t } = useTranslation('respond');
  const durationWords = useDurationWords();
  const serviceId = service.id;
  const [mode, setMode] = useState<'days' | 'monthly'>(
    item?.monthly ? 'monthly' : 'days'
  );
  const [month, setMonth] = useState(() => monthOf(new Date()));
  const [viewed, setViewed] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [dropped, setDropped] = useState(false);
  const [note, setNote] = useState<Note>();
  const [cache, setCache] = useState<Cache>({ key: '', months: {} });
  const [failed, setFailed] = useState<string | null>(null);
  const seeking = useRef(true);
  const cached = useRef(cache);
  cached.current = cache;
  const key = `${reloadKey ?? ''}|${attempt}`;
  const preview = !loadSlots;
  const loader = useRef<LoadSlots>(async () => ({ slots: [], full: [] }));
  loader.current =
    loadSlots ??
    (async (_id, from, to) => ({
      slots: previewSlots(service, from, to, new Date()),
      full: [],
    }));
  const latest = useRef({ item, onItem });
  latest.current = { item, onItem };
  const sessions = item?.sessions ?? [];
  const monthly = item?.monthly;

  useEffect(() => {
    if (mode === 'monthly') return;
    if (cached.current.key === key && cached.current.months[month]) return;
    const today = new Date();
    const range = monthRange(month, today);
    if (!range) return;
    let current = true;
    loader.current(serviceId, range.from, range.to)
      .then(loaded => {
        if (!current) return;
        setCache(previous => ({
          key,
          months: {
            ...(previous.key === key ? previous.months : {}),
            [month]: loaded,
          },
        }));
        const { item: chosen, onItem: update } = latest.current;
        const kept = keepFree(chosen?.sessions ?? [], loaded.slots, range);
        if (chosen && kept.length !== chosen.sessions.length) {
          setDropped(true);
          update(kept.length ? { service: chosen.service, sessions: kept } : undefined);
        }
        if (seeking.current) {
          if (loaded.slots.length === 0 && canGoNext(month, today))
            setMonth(shiftMonth(month, 1));
          else seeking.current = false;
        }
      })
      .catch(() => current && setFailed(`${key}|${month}`));
    return () => {
      current = false;
    };
  }, [mode, month, key]);

  const goMonth = (next: string) => {
    seeking.current = false;
    setMonth(next);
  };

  const chooseMode = (next: 'days' | 'monthly') => {
    if (next === mode) return;
    setMode(next);
    setNote(undefined);
    onItem(undefined);
  };

  const toggle = (date: string, time: string, duration: number) => {
    setDropped(false);
    const result = toggleSession(
      sessions.map(session => ({
        ...session,
        duration: session.duration ?? service.duration,
      })),
      { date, time, duration },
      field.buffer_minutes ?? field.rules?.buffer_minutes ?? 0,
      others
    );
    if (result.kind === 'overlap') {
      setNote({ kind: 'overlap', date, time, duration, clash: result.clash });
      return;
    }
    setNote({ kind: result.kind, date, time, duration });
    onItem(
      result.sessions.length
        ? { service: serviceId, sessions: result.sessions }
        : undefined
    );
  };

  const months = cache.key === key ? cache.months : {};
  const loaded = months[month];
  const status = loaded
    ? 'ready'
    : failed === `${key}|${month}`
      ? 'error'
      : 'loading';
  const byDay = new Map<string, FormSlot[]>();
  for (const data of Object.values(months))
    for (const slot of data.slots)
      byDay.set(slot.date, [...(byDay.get(slot.date) ?? []), slot]);
  const shown =
    viewed && viewed.startsWith(month) && byDay.has(viewed) ? viewed : undefined;
  const today = new Date();
  const several = hasSeveralDurations(service);
  const priceText = (price: number | null | undefined, currency?: string | null) =>
    price ? formatCurrency(price, currency ?? 'EUR') : null;
  const optionText = (duration: number, price: number | null | undefined) =>
    [durationText(duration, durationWords), priceText(price, service.currency)]
      .filter(Boolean)
      .join(' · ');
  const chip = (selected: boolean, size = 'text-sm!') =>
    `min-h-11 rounded-lg px-3 py-1.5 ${size} font-medium! ${theme.button} ${selected ? 'ring-2 ring-current' : ''}`;
  const picked = new Map<string, string[]>();
  for (const session of sessions)
    picked.set(session.date, [...(picked.get(session.date) ?? []), session.time]);
  const isPicked = (date: string, time: string, duration: number) =>
    sessions.some(
      session =>
        session.date === date &&
        session.time === time &&
        (session.duration ?? service.duration) === duration
    );
  const sessionText = (time: string, duration: number | undefined) =>
    several
      ? `${time} · ${durationText(duration ?? service.duration, durationWords)}`
      : time;
  const offeredDurations = (slot: FormSlot) =>
    preview
      ? bookingOptions(service).map(entry => entry.duration)
      : slot.durations?.length
        ? slot.durations
        : [service.duration];
  const priceOf = (duration: number) =>
    duration === service.duration
      ? service.price
      : service.extra_durations?.find(entry => entry.duration === duration)?.price;
  const noteWhen = (entry: Note) =>
    t('booking_when', { date: dayLabel(entry.date), time: entry.time });
  const overlapText = (clash: PickedSession) =>
    clash.service
      ? t('booking_note_overlap_service', {
          service: clash.service,
          what: clash.time,
        })
      : t('booking_note_overlap', {
          what: sessionText(clash.time, clash.duration),
        });
  let message: string | undefined;
  if (shown) {
    if (note && note.date === shown) {
      message =
        note.kind === 'saved'
          ? t('booking_note_saved', {
              what: several
                ? `${noteWhen(note)} · ${optionText(note.duration, priceOf(note.duration))}`
                : noteWhen(note),
            })
          : note.kind === 'removed'
            ? t('booking_note_removed', { what: noteWhen(note) })
            : overlapText(note.clash!);
    } else if (picked.has(shown)) {
      const sameDay = sessions.filter(session => session.date === shown);
      message = t('booking_note_kept', {
        count: sameDay.length,
        what: sameDay
          .map(session => sessionText(session.time, session.duration))
          .join(', '),
      });
    }
  }
  const modeId = `${inputId}-${serviceId}-mode`;
  const modeCard = (selected: boolean) =>
    `flex min-w-0 flex-col gap-1 rounded-xl p-4 text-left ${theme.button} ${selected ? 'ring-2 ring-current' : ''}`;
  const warning = note?.kind === 'overlap' && note.date === shown;

  const body = (
    <>
      {service.monthly && (
        <div className="space-y-2">
          <p id={modeId} className="text-xl font-semibold">
            {t('booking_mode')}
          </p>
          <fieldset
            role="radiogroup"
            aria-labelledby={modeId}
            className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-2"
          >
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'days'}
              className={modeCard(mode === 'days')}
              onClick={() => chooseMode('days')}
            >
              <span className="text-[15px] font-semibold">
                {t('booking_mode_days')}
              </span>
              {cheapestPrice(service) ? (
                <span className="text-[22px] font-semibold">
                  {several && (
                    <span className="mr-1 text-xs font-normal opacity-80">
                      {t('booking_from')}
                    </span>
                  )}
                  {formatCurrency(
                    cheapestPrice(service)!,
                    service.currency ?? 'EUR'
                  )}
                  <span className="text-xs font-normal opacity-80">
                    {` ${t('booking_unit_session')}`}
                  </span>
                </span>
              ) : null}
              <span className="text-xs opacity-80">
                {several
                  ? t('booking_mode_days_desc_each')
                  : t('booking_mode_days_desc', { count: service.duration })}
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'monthly'}
              className={modeCard(mode === 'monthly')}
              onClick={() => chooseMode('monthly')}
            >
              <span className="text-[15px] font-semibold">
                {t('booking_mode_monthly')}
              </span>
              {service.monthly.price ? (
                <span className="text-[22px] font-semibold">
                  {formatCurrency(
                    service.monthly.price,
                    service.currency ?? 'EUR'
                  )}
                  <span className="text-xs font-normal opacity-80">
                    {` ${t('booking_unit_month')}`}
                  </span>
                </span>
              ) : null}
              <span className="text-xs opacity-80">
                {t('booking_mode_monthly_desc', {
                  duration: durationText(monthlyMinutes(service), durationWords),
                })}
              </span>
            </button>
          </fieldset>
        </div>
      )}

      {mode === 'monthly' && (
        <MonthlyPicker
          service={service}
          value={monthly}
          theme={theme}
          chip={chip}
          onChange={choice =>
            onItem(
              choice
                ? { service: service.id, sessions: [], monthly: choice }
                : undefined
            )
          }
        />
      )}

      {mode === 'days' && (
        <div className="space-y-3">
          {dropped && (
            <p role="alert" className="text-sm font-medium">
              {t('booking_taken')}
            </p>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xl font-semibold">{t('booking_pick')}</p>
            {field.time_zone && (
              <p className="text-xs opacity-70">
                {t('booking_zone', { zone: field.time_zone })}
              </p>
            )}
          </div>
          {status === 'error' ? (
            <div className="space-y-2">
              <p role="alert" className="text-sm">
                {t('booking_load_failed')}
              </p>
              <button
                type="button"
                className={chip(false)}
                onClick={() => setAttempt(count => count + 1)}
              >
                {t('booking_retry')}
              </button>
            </div>
          ) : (
            <>
              <BookingCalendar
                month={month}
                today={today}
                available={new Set(loaded?.slots.map(slot => slot.date))}
                chosen={picked}
                viewed={shown}
                theme={theme}
                onView={iso => {
                  setViewed(iso);
                  setNote(undefined);
                }}
                onMonth={goMonth}
              />
              {status === 'loading' && (
                <p className="text-sm opacity-80">{t('booking_loading')}</p>
              )}
              {status === 'ready' && loaded.slots.length === 0 && (
                <p className="text-sm opacity-80">{t('booking_none')}</p>
              )}
              {preview && (
                <p className="text-xs opacity-70">{t('booking_preview_note')}</p>
              )}
              {shown ? (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 text-[15px] font-semibold">
                      <span className="font-normal opacity-80">
                        {t('booking_times_on')}
                      </span>{' '}
                      <span className="first-letter:uppercase">
                        {dayHeading(shown)}
                      </span>
                    </p>
                    <p className="shrink-0 whitespace-nowrap text-xs opacity-70">
                      {t('booking_free_count', {
                        count: byDay.get(shown)!.length,
                      })}
                    </p>
                  </div>
                  <div
                    className={`grid gap-2 rounded-xl border border-dashed p-2 ${
                      sessions.length > 0
                        ? 'border-teal-500/60'
                        : 'border-transparent'
                    } ${
                      several
                        ? 'grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]'
                        : 'grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))]'
                    }`}
                  >
                    {byDay.get(shown)!.flatMap(slot =>
                      offeredDurations(slot).map(duration => {
                        const selected = isPicked(shown, slot.time, duration);
                        return (
                          <button
                            key={`${slot.starts_at}-${duration}`}
                            type="button"
                            aria-pressed={selected}
                            className={`${chip(false, 'text-[15px]!')} min-h-12 ${selected ? 'ring-2 ring-teal-500' : ''}`}
                            onClick={() => toggle(shown, slot.time, duration)}
                          >
                            {several ? (
                              <span className="flex flex-col items-center leading-tight">
                                <span>{slot.time}</span>
                                <span className="text-xs font-normal opacity-80">
                                  {optionText(duration, priceOf(duration))}
                                </span>
                              </span>
                            ) : (
                              slot.time
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                  <div aria-live="polite">
                    {message && (
                      <p
                        className={`flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm font-medium ${
                          warning
                            ? 'border-amber-500/70 bg-amber-500/15'
                            : 'border-teal-500/60 bg-teal-500/15'
                        }`}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 16 16"
                          className={`mt-0.5 h-4 w-4 shrink-0 fill-none stroke-2 ${
                            warning ? 'stroke-amber-500' : 'stroke-teal-500'
                          }`}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          {warning ? (
                            <path d="M8 3v6M8 12.5v.01" />
                          ) : (
                            <path d="M3 8.5l3.2 3.2L13 4.5" />
                          )}
                        </svg>
                        <span>{message}</span>
                      </p>
                    )}
                  </div>
                  <p className="text-xs opacity-70">{t('booking_pick_hint')}</p>
                </div>
              ) : (
                status === 'ready' &&
                loaded.slots.length > 0 && (
                  <p className="rounded-lg border border-dashed border-current/30 p-4 text-center text-[13px] opacity-80">
                    {t('booking_choose_day')}
                  </p>
                )
              )}
              {field.waitlist && joinWaitlist && (
                <WaitlistJoin
                  key={serviceId}
                  serviceId={serviceId}
                  full={Object.values(months).flatMap(data => data.full)}
                  theme={theme}
                  chip={chip}
                  dayLabel={dayLabel}
                  join={joinWaitlist}
                />
              )}
            </>
          )}
        </div>
      )}

      {!hideSummary && mode === 'days' && sessions.length > 0 && (
        <div
          className="rounded-lg border border-current/20 px-3 py-2 text-sm"
          aria-live="polite"
        >
          <p className="font-medium">{t('booking_summary')}</p>
          <ul className="mt-1 space-y-0.5">
            {sessions.map(session => (
              <li key={`${session.date}-${session.time}`}>
                {dayLabel(session.date)} · {session.time}
                {several && session.duration
                  ? ` · ${optionText(session.duration, priceOf(session.duration))}`
                  : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  if (!multiple) return body;
  return (
    <section
      aria-label={service.name}
      className="space-y-4 rounded-xl border border-current/20 p-4"
    >
      <p className="text-base font-semibold">{service.name}</p>
      {body}
    </section>
  );
}

type MonthlyChoiceValue = { month: string; weekdays: string[]; time: string };

function MonthlyPicker({
  service,
  value,
  theme,
  chip,
  onChange,
}: {
  service: Service;
  value: MonthlyChoiceValue | undefined;
  theme: BioTheme;
  chip: (selected: boolean) => string;
  onChange: (choice: MonthlyChoiceValue | undefined) => void;
}) {
  const { t } = useTranslation('respond');
  const durationWords = useDurationWords();
  const months = monthOptions(new Date());
  const times = [...service.times].sort();
  const [draft, setDraft] = useState<MonthlyChoiceValue>(
    value ?? { month: months[0].value, weekdays: [], time: times[0] ?? '' }
  );
  const update = (next: Partial<MonthlyChoiceValue>) => {
    const merged = { ...draft, ...next };
    setDraft(merged);
    onChange(monthlyComplete(merged) ? merged : undefined);
  };
  const shown = draft;
  const dayLabels: Record<(typeof WEEKDAYS)[number], string> = {
    mon: t('monthly_day_mon'),
    tue: t('monthly_day_tue'),
    wed: t('monthly_day_wed'),
    thu: t('monthly_day_thu'),
    fri: t('monthly_day_fri'),
    sat: t('monthly_day_sat'),
    sun: t('monthly_day_sun'),
  };
  const dates = monthlyDates(shown.month, shown.weekdays, new Date());

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t('monthly_month')}</p>
      <div className="flex flex-wrap gap-2">
        {months.map(item => (
          <button
            key={item.value}
            type="button"
            aria-pressed={shown.month === item.value}
            className={chip(shown.month === item.value)}
            onClick={() => update({ month: item.value })}
          >
            {formatDate(item.date.toISOString(), {
              month: 'long',
              year: 'numeric',
            })}
          </button>
        ))}
      </div>
      <p className="text-sm font-medium">{t('monthly_weekdays')}</p>
      <div className="flex flex-wrap gap-2">
        {WEEKDAYS.filter(day => service.days.includes(day)).map(day => (
          <button
            key={day}
            type="button"
            aria-pressed={shown.weekdays.includes(day)}
            className={chip(shown.weekdays.includes(day))}
            onClick={() =>
              update({ weekdays: toggleWeekday(shown.weekdays, day) })
            }
          >
            {dayLabels[day]}
          </button>
        ))}
      </div>
      <p className="text-sm font-medium">{t('monthly_time')}</p>
      <div className="flex flex-wrap gap-2">
        {times.map(time => (
          <button
            key={time}
            type="button"
            aria-pressed={shown.time === time}
            className={chip(shown.time === time)}
            onClick={() => update({ time })}
          >
            {time}
          </button>
        ))}
      </div>
      {value && (
        <div
          className="rounded-lg border border-current/20 px-3 py-2 text-sm"
          aria-live="polite"
        >
          <p className="font-medium">
            {t('monthly_summary', {
              count: dates.length,
              duration: durationText(monthlyMinutes(service), durationWords),
            })}
          </p>
          <p className={`mt-1 text-xs ${theme.bio}`}>{t('monthly_note')}</p>
        </div>
      )}
    </div>
  );
}
