import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormField } from '@internal/core/types/Form';
import type {
  FormSlot,
  LoadedSlots,
} from '@internal/core/actions/get-form-slots/get-form-slots.types';
import type { BioTheme } from '../bio-page/themes';
import { formatCurrency, formatDate } from '../../i18n/format';
import { WaitlistJoin, type JoinWaitlist } from './waitlist-join';
import { BookingCalendar } from './booking-calendar.tsx';
import { BookingNote } from './booking-note.tsx';
import { PickHeading } from './pick-heading.tsx';
import {
  bufferOf,
  canGoNext,
  keepFree,
  monthRange,
  previewSlots,
  shiftMonth,
  toggleSession,
  type PickedSession,
} from './booking-calendar.ts';
import {
  bookingOptions,
  durationText,
  hasSeveralDurations,
  type Allowance,
} from './booking-options.ts';
import { useDurationWords } from './use-duration-words.ts';
import type { PickerMemory } from './picker-memory.ts';
import { useViewZone } from './view-zone.tsx';
import {
  distinct,
  groupByViewDay,
  localToday,
  requestRange,
} from './zone-time.ts';

export type LoadSlots = (
  service: string,
  from: string,
  to: string,
  monthly?: boolean
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

type Note = {
  kind: 'saved' | 'removed' | 'overlap' | 'limit';
  date: string;
  time: string;
  duration: number;
  clash?: PickedSession;
  per?: Allowance['per'];
};

type Service = NonNullable<FormField['services']>[number];

export type Chosen = { date: string; time: string; duration?: number };

export function SessionPicker({
  field,
  service,
  picks,
  onPicks,
  others,
  theme,
  chip,
  loadSlots,
  joinWaitlist,
  reloadKey,
  hideSummary,
  memory,
  month: fixedMonth,
  duration: fixedDuration,
  cap,
  shared,
}: {
  field: FormField;
  service: Service;
  picks: Chosen[];
  onPicks: (picks: Chosen[]) => void;
  others: PickedSession[];
  theme: BioTheme;
  chip: (selected: boolean, size?: string) => string;
  loadSlots?: LoadSlots;
  joinWaitlist?: JoinWaitlist;
  reloadKey?: string;
  hideSummary?: boolean;
  memory: PickerMemory;
  month?: string;
  duration?: number;
  cap?: Allowance;
  shared?: boolean;
}) {
  const { t } = useTranslation('respond');
  const durationWords = useDurationWords();
  const serviceId = service.id;
  const { cache, setCache, seeking } = memory;
  const month = fixedMonth ?? memory.month;
  const { zone, formZone, toView } = useViewZone();
  const [viewed, setViewed] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [dropped, setDropped] = useState(false);
  const [note, setNote] = useState<Note>();
  const [failed, setFailed] = useState<string | null>(null);
  const cached = useRef(cache);
  cached.current = cache;
  const key = `${reloadKey ?? ''}|${attempt}|${zone ?? ''}`;
  const preview = !loadSlots;
  const loader = useRef<LoadSlots>(async () => ({ slots: [], full: [] }));
  loader.current =
    loadSlots ??
    (async (_id, from, to) => ({
      slots: previewSlots(service, from, to, localToday(formZone), formZone),
      full: [],
    }));
  const latest = useRef({ picks, onPicks });
  latest.current = { picks, onPicks };
  const lasts = fixedDuration ?? service.duration;

  useEffect(() => {
    if (cached.current.key === key && cached.current.months[month]) return;
    const today = localToday(zone);
    const range = monthRange(month, today);
    if (!range) return;
    const asked = requestRange(range, formZone, zone);
    let current = true;
    loader.current(serviceId, asked.from, asked.to, fixedDuration !== undefined)
      .then(loaded => {
        if (!current) return;
        setCache(previous => ({
          key,
          months: {
            ...(previous.key === key ? previous.months : {}),
            [month]: loaded,
          },
        }));
        const { picks: chosen, onPicks: update } = latest.current;
        const kept = keepFree(chosen, loaded.slots, asked);
        if (kept.length !== chosen.length) {
          setDropped(true);
          update(kept);
        }
        if (seeking.current) {
          const open = [
            ...groupByViewDay(loaded.slots, formZone, zone).keys(),
          ].some(day => day.startsWith(month));
          if (!open && canGoNext(month, today))
            memory.setMonth(shiftMonth(month, 1));
          else seeking.current = false;
        }
      })
      .catch(() => current && setFailed(`${key}|${month}`));
    return () => {
      current = false;
    };
  }, [month, key]);

  const goMonth = (next: string) => {
    seeking.current = false;
    memory.setMonth(next);
  };

  const toggle = (date: string, time: string, minutes: number) => {
    setDropped(false);
    const result = toggleSession(
      picks.map(pick => ({ ...pick, duration: pick.duration ?? lasts })),
      { date, time, duration: minutes },
      bufferOf(field),
      others,
      cap
    );
    if (result.kind === 'overlap') {
      setNote({
        kind: 'overlap',
        date,
        time,
        duration: minutes,
        clash: result.clash,
      });
      return;
    }
    if (result.kind === 'limit') {
      setNote({
        kind: 'limit',
        date,
        time,
        duration: minutes,
        per: result.per,
      });
      return;
    }
    setNote({ kind: result.kind, date, time, duration: minutes });
    onPicks(result.sessions);
  };

  const months = cache.key === key ? cache.months : {};
  const loaded = months[month];
  const status = loaded
    ? 'ready'
    : failed === `${key}|${month}`
      ? 'error'
      : 'loading';
  const byDay = useMemo(() => {
    const offered = Object.values(months).flatMap(data => data.slots);
    return groupByViewDay(
      fixedMonth
        ? offered.filter(slot => slot.date.startsWith(fixedMonth))
        : offered,
      formZone,
      zone
    );
  }, [months, fixedMonth, formZone, zone]);
  const monthDays = new Set([...byDay.keys()].filter(day => day.startsWith(month)));
  const shown =
    viewed && viewed.startsWith(month) && byDay.has(viewed) ? viewed : undefined;
  const today = localToday(zone);
  const several = fixedDuration === undefined && hasSeveralDurations(service);
  const priceText = (price: number | null | undefined, currency?: string | null) =>
    price ? formatCurrency(price, currency ?? 'EUR') : null;
  const optionText = (minutes: number, price: number | null | undefined) =>
    [durationText(minutes, durationWords), priceText(price, service.currency)]
      .filter(Boolean)
      .join(' · ');
  const picked = new Map<string, string[]>();
  for (const pick of picks) {
    const view = toView(pick);
    picked.set(view.date, [...(picked.get(view.date) ?? []), view.time]);
  }
  const isPicked = (date: string, time: string, minutes: number) =>
    picks.some(
      pick =>
        pick.date === date &&
        pick.time === time &&
        (pick.duration ?? lasts) === minutes
    );
  const sessionText = (time: string, minutes: number | undefined) =>
    several ? `${time} · ${durationText(minutes ?? lasts, durationWords)}` : time;
  const offeredDurations = (slot: FormSlot) =>
    fixedDuration !== undefined
      ? [fixedDuration]
      : preview
        ? bookingOptions(service).map(entry => entry.duration)
        : slot.durations?.length
          ? slot.durations
          : [service.duration];
  const priceOf = (minutes: number) =>
    minutes === service.duration
      ? service.price
      : service.extra_durations?.find(entry => entry.duration === minutes)?.price;
  const noteWhen = (entry: Note) => {
    const view = toView(entry);
    return t('booking_when', { date: dayLabel(view.date), time: view.time });
  };
  const overlapText = (clash: PickedSession) =>
    clash.service
      ? t('booking_note_overlap_service', {
          service: clash.service,
          what: toView(clash).time,
        })
      : t('booking_note_overlap', {
          what: sessionText(toView(clash).time, clash.duration),
        });
  const limitText = (per: Allowance['per'] | undefined) =>
    per === 'week'
      ? t('plan_week_full', { count: cap?.limit })
      : t('plan_full', { count: cap?.limit });
  const noteDay = note && toView(note).date;
  let message: string | undefined;
  if (shown) {
    if (note && noteDay === shown) {
      message =
        note.kind === 'saved'
          ? t('booking_note_saved', {
              what: several
                ? `${noteWhen(note)} · ${optionText(note.duration, priceOf(note.duration))}`
                : noteWhen(note),
            })
          : note.kind === 'removed'
            ? t('booking_note_removed', { what: noteWhen(note) })
            : note.kind === 'limit'
              ? limitText(note.per)
              : overlapText(note.clash!);
    } else if (picked.has(shown)) {
      const sameDay = picks.filter(pick => toView(pick).date === shown);
      message = t('booking_note_kept', {
        count: sameDay.length,
        what: sameDay
          .map(pick => sessionText(toView(pick).time, pick.duration))
          .join(', '),
      });
    }
  }
  const warning =
    (note?.kind === 'overlap' || note?.kind === 'limit') && noteDay === shown;

  return (
    <>
      <div className="space-y-3">
        {dropped && (
          <p role="alert" className="text-sm font-medium">
            {shared
              ? t('booking_taken_service', { service: service.name })
              : t('booking_taken')}
          </p>
        )}
        {!shared && <PickHeading theme={theme} />}
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
              available={monthDays}
              chosen={picked}
              viewed={shown}
              theme={theme}
              onView={iso => {
                setViewed(iso);
                setNote(undefined);
              }}
              onMonth={fixedMonth === undefined ? goMonth : undefined}
            />
            {status === 'loading' && (
              <p className="text-sm opacity-80">{t('booking_loading')}</p>
            )}
            {status === 'ready' && monthDays.size === 0 && (
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
                    picks.length > 0
                      ? 'border-teal-500/60'
                      : 'border-transparent'
                  } ${
                    several
                      ? 'grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]'
                      : 'grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))]'
                  }`}
                >
                  {byDay.get(shown)!.flatMap(slot =>
                    offeredDurations(slot).map(minutes => {
                      const selected = isPicked(slot.date, slot.time, minutes);
                      return (
                        <button
                          key={`${slot.starts_at}-${minutes}`}
                          type="button"
                          aria-pressed={selected}
                          className={`${chip(false, 'text-[15px]!')} min-h-12 ${selected ? 'ring-2 ring-teal-500' : ''}`}
                          onClick={() => toggle(slot.date, slot.time, minutes)}
                        >
                          {several ? (
                            <span className="flex flex-col items-center leading-tight">
                              <span>{slot.viewTime}</span>
                              <span className="text-xs font-normal opacity-80">
                                {optionText(minutes, priceOf(minutes))}
                              </span>
                            </span>
                          ) : (
                            slot.viewTime
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
                <BookingNote message={message} warning={warning} />
                <p className="text-xs opacity-70">
                  {cap ? t('plan_pick_hint') : t('booking_pick_hint')}
                </p>
              </div>
            ) : (
              status === 'ready' &&
              monthDays.size > 0 && (
                <p className="rounded-lg border border-dashed border-current/30 p-4 text-center text-[13px] opacity-80">
                  {t('booking_choose_day')}
                </p>
              )
            )}
            {field.waitlist && joinWaitlist && (
              <WaitlistJoin
                key={serviceId}
                serviceId={serviceId}
                full={distinct(Object.values(months).flatMap(data => data.full))}
                theme={theme}
                chip={chip}
                dayLabel={dayLabel}
                join={joinWaitlist}
              />
            )}
          </>
        )}
      </div>

      {!hideSummary && picks.length > 0 && (
        <div
          className="rounded-lg border border-current/20 px-3 py-2 text-sm"
          aria-live="polite"
        >
          <p className="font-medium">{t('booking_summary')}</p>
          <ul className="mt-1 space-y-0.5">
            {picks.map(pick => (
              <li key={`${pick.date}-${pick.time}`}>
                {dayLabel(toView(pick).date)} · {toView(pick).time}
                {several && pick.duration
                  ? ` · ${optionText(pick.duration, priceOf(pick.duration))}`
                  : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
