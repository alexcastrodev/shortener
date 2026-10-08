import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BookingAnswer, FormField } from '@internal/core/types/Form';
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
} from './booking-calendar.ts';
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

export type { JoinWaitlist };

const dayLabel = (iso: string) =>
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

export function BookingInput({
  field,
  value,
  onChange,
  theme,
  inputId,
  loadSlots,
  joinWaitlist,
  reloadKey,
}: {
  field: FormField;
  value: BookingAnswer | undefined;
  onChange: (value: BookingAnswer | undefined) => void;
  theme: BioTheme;
  inputId: string;
  loadSlots?: LoadSlots;
  joinWaitlist?: JoinWaitlist;
  reloadKey?: string;
}) {
  const { t } = useTranslation('respond');
  const allServices = field.services ?? [];
  const categories = field.categories ?? [];
  const grouped = categories.length >= 2;
  const [categoryId, setCategoryId] = useState<string | undefined>(
    allServices.find(item => item.id === value?.service)?.category_id ??
      undefined
  );
  const services = grouped
    ? allServices.filter(item => item.category_id === categoryId)
    : allServices;
  const [serviceId, setServiceId] = useState<string | undefined>(
    value?.service ??
      (!grouped && services.length === 1 ? services[0].id : undefined)
  );
  const [mode, setMode] = useState<'days' | 'monthly'>(
    value?.monthly ? 'monthly' : 'days'
  );
  const [month, setMonth] = useState(() => monthOf(new Date()));
  const [viewed, setViewed] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [dropped, setDropped] = useState(false);
  const [cache, setCache] = useState<Cache>({ key: '', months: {} });
  const [failed, setFailed] = useState<string | null>(null);
  const seeking = useRef(true);
  const cached = useRef(cache);
  cached.current = cache;
  const key = `${serviceId}|${reloadKey ?? ''}|${attempt}`;
  const preview = !loadSlots;
  const loader = useRef<LoadSlots>(async () => ({ slots: [], full: [] }));
  loader.current =
    loadSlots ??
    (async (id, from, to) => ({
      slots: previewSlots(
        allServices.find(item => item.id === id) ?? {
          days: [],
          times: [],
        },
        from,
        to,
        new Date()
      ),
      full: [],
    }));
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const sessions = value?.sessions ?? [];
  const monthly = value?.monthly;

  useEffect(() => {
    if (!serviceId || mode === 'monthly') return;
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
        const { value: chosen, onChange: update } = latest.current;
        const kept = keepFree(chosen?.sessions ?? [], loaded.slots, range);
        if (chosen && kept.length !== chosen.sessions.length) {
          setDropped(true);
          update(
            kept.length
              ? { service: chosen.service, sessions: kept }
              : undefined
          );
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
  }, [serviceId, mode, month, key]);

  const restartView = () => {
    seeking.current = true;
    setMonth(monthOf(new Date()));
    setViewed(undefined);
  };

  const goMonth = (next: string) => {
    seeking.current = false;
    setMonth(next);
  };

  const chooseCategory = (id: string) => {
    if (id === categoryId) return;
    setCategoryId(id);
    const inside = allServices.filter(item => item.category_id === id);
    setServiceId(inside.length === 1 ? inside[0].id : undefined);
    setDropped(false);
    restartView();
    onChange(undefined);
  };

  const chooseService = (id: string) => {
    if (id === serviceId) return;
    setServiceId(id);
    setMode('days');
    setDropped(false);
    restartView();
    onChange(undefined);
  };

  const chooseMode = (next: 'days' | 'monthly') => {
    if (next === mode) return;
    setMode(next);
    onChange(undefined);
  };

  const toggle = (date: string, time: string) => {
    if (!serviceId) return;
    setDropped(false);
    const others = sessions.filter(session => session.date !== date);
    const same = sessions.some(
      session => session.date === date && session.time === time
    );
    const next = same
      ? others
      : [...others, { date, time }].sort((a, b) =>
          `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)
        );
    onChange(next.length ? { service: serviceId, sessions: next } : undefined);
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
  const service = services.find(item => item.id === serviceId);
  const chip = (selected: boolean) =>
    `min-h-11 rounded-lg px-3 py-1.5 text-sm font-medium ${theme.button} ${selected ? 'ring-2 ring-current' : ''}`;
  const picked = new Map(sessions.map(session => [session.date, session.time]));
  const modeCard = (selected: boolean) =>
    `flex min-w-0 flex-col gap-1 rounded-xl p-4 text-left ${theme.button} ${selected ? 'ring-2 ring-current' : ''}`;

  return (
    <div id={inputId} className="space-y-4">
      {grouped && (
        <fieldset
          role="radiogroup"
          aria-label={t('booking_category')}
          className="space-y-2"
        >
          {categories.map(item => {
            const count = allServices.filter(
              entry => entry.category_id === item.id
            ).length;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={item.id === categoryId}
                onClick={() => chooseCategory(item.id)}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${theme.button} ${item.id === categoryId ? 'ring-2 ring-current' : ''}`}
              >
                <span className="font-medium">{item.name}</span>
                <span className="text-sm opacity-80">
                  {t('booking_services_count', { count })}
                </span>
              </button>
            );
          })}
        </fieldset>
      )}
      {services.length > 1 ? (
        <fieldset
          role="radiogroup"
          aria-label={t('booking_service')}
          className="space-y-2"
        >
          {services.map(item => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={item.id === serviceId}
              onClick={() => chooseService(item.id)}
              className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${theme.button} ${item.id === serviceId ? 'ring-2 ring-current' : ''}`}
            >
              <span className="font-medium">{item.name}</span>
              <span className="text-sm opacity-80">
                {t('booking_minutes', { count: item.duration })}
                {item.price
                  ? ` · ${formatCurrency(item.price, item.currency ?? 'EUR')}`
                  : ''}
              </span>
            </button>
          ))}
        </fieldset>
      ) : (
        service && (
          <p className="text-sm font-medium">
            {service.name}
            {!service.monthly && (
              <span className="font-normal opacity-80">
                {` · ${t('booking_minutes', { count: service.duration })}`}
                {service.price
                  ? ` · ${formatCurrency(service.price, service.currency ?? 'EUR')}`
                  : ''}
              </span>
            )}
          </p>
        )
      )}

      {serviceId && service?.monthly && (
        <div className="space-y-2">
          <p id={`${inputId}-mode`} className="text-sm font-medium">
            {t('booking_mode')}
          </p>
          <fieldset
            role="radiogroup"
            aria-labelledby={`${inputId}-mode`}
            className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-2"
          >
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'days'}
              className={modeCard(mode === 'days')}
              onClick={() => chooseMode('days')}
            >
              <span className="text-sm font-semibold">
                {t('booking_mode_days')}
              </span>
              {service.price ? (
                <span className="text-xl font-semibold">
                  {formatCurrency(service.price, service.currency ?? 'EUR')}
                  <span className="text-xs font-normal opacity-80">
                    {` ${t('booking_unit_session')}`}
                  </span>
                </span>
              ) : null}
              <span className="text-xs opacity-80">
                {t('booking_mode_days_desc', { count: service.duration })}
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'monthly'}
              className={modeCard(mode === 'monthly')}
              onClick={() => chooseMode('monthly')}
            >
              <span className="text-sm font-semibold">
                {t('booking_mode_monthly')}
              </span>
              {service.monthly.price ? (
                <span className="text-xl font-semibold">
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
                {t('booking_mode_monthly_desc')}
              </span>
            </button>
          </fieldset>
        </div>
      )}

      {serviceId && service && mode === 'monthly' && (
        <MonthlyPicker
          service={service}
          value={monthly}
          theme={theme}
          chip={chip}
          onChange={choice =>
            onChange(
              choice
                ? { service: service.id, sessions: [], monthly: choice }
                : undefined
            )
          }
        />
      )}

      {serviceId && mode === 'days' && (
        <div className="space-y-3">
          {dropped && (
            <p role="alert" className="text-sm font-medium">
              {t('booking_taken')}
            </p>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium">{t('booking_pick')}</p>
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
                onView={setViewed}
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
                    <p className="min-w-0 text-sm font-medium">
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
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
                    {byDay.get(shown)!.map(slot => {
                      const selected = picked.get(shown) === slot.time;
                      return (
                        <button
                          key={slot.starts_at}
                          type="button"
                          aria-pressed={selected}
                          className={`${chip(selected)} min-h-12`}
                          onClick={() => toggle(shown, slot.time)}
                        >
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs opacity-70">{t('booking_pick_hint')}</p>
                </div>
              ) : (
                status === 'ready' &&
                loaded.slots.length > 0 && (
                  <p className="rounded-lg border border-dashed border-current/30 p-4 text-center text-sm opacity-80">
                    {t('booking_choose_day')}
                  </p>
                )
              )}
              {field.waitlist && joinWaitlist && serviceId && (
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

      {mode === 'days' && sessions.length > 0 && (
        <div
          className="rounded-lg border border-current/20 px-3 py-2 text-sm"
          aria-live="polite"
        >
          <p className="font-medium">{t('booking_summary')}</p>
          <ul className="mt-1 space-y-0.5">
            {sessions.map(session => (
              <li key={session.date}>
                {dayLabel(session.date)} · {session.time}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
  service: NonNullable<FormField['services']>[number];
  value: MonthlyChoiceValue | undefined;
  theme: BioTheme;
  chip: (selected: boolean) => string;
  onChange: (choice: MonthlyChoiceValue | undefined) => void;
}) {
  const { t } = useTranslation('respond');
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
            {t('monthly_summary', { count: dates.length })}
          </p>
          <p className={`mt-1 text-xs ${theme.bio}`}>{t('monthly_note')}</p>
        </div>
      )}
    </div>
  );
}
