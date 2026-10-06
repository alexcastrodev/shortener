import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BookingAnswer, FormField } from '@internal/core/types/Form';
import type { FormSlot } from '@internal/core/actions/get-form-slots/get-form-slots.types';
import type { BioTheme } from '../bio-page/themes';
import { formatCurrency, formatDate } from '../../i18n/format';

export type LoadSlots = (service: string, from: string, to: string) => Promise<FormSlot[]>;

const STEP_DAYS = 14;
const MAX_DAYS = 56;

const pad = (value: number) => String(value).padStart(2, '0');
const isoDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const dayLabel = (iso: string) =>
  formatDate(`${iso}T00:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

type State = { status: 'loading' | 'ready' | 'error'; slots: FormSlot[] };

export function BookingInput({
  field,
  value,
  onChange,
  theme,
  inputId,
  loadSlots,
  reloadKey,
}: {
  field: FormField;
  value: BookingAnswer | undefined;
  onChange: (value: BookingAnswer | undefined) => void;
  theme: BioTheme;
  inputId: string;
  loadSlots?: LoadSlots;
  reloadKey?: string;
}) {
  const { t } = useTranslation('respond');
  const allServices = field.services ?? [];
  const categories = field.categories ?? [];
  const grouped = categories.length >= 2;
  const [categoryId, setCategoryId] = useState<string | undefined>(
    allServices.find(item => item.id === value?.service)?.category_id ?? undefined
  );
  const services = grouped ? allServices.filter(item => item.category_id === categoryId) : allServices;
  const [serviceId, setServiceId] = useState<string | undefined>(
    value?.service ?? (!grouped && services.length === 1 ? services[0].id : undefined)
  );
  const [days, setDays] = useState(STEP_DAYS);
  const [attempt, setAttempt] = useState(0);
  const [dropped, setDropped] = useState(false);
  const [state, setState] = useState<State>({ status: 'loading', slots: [] });
  const loader = useRef(loadSlots);
  loader.current = loadSlots;
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const live = !!loadSlots;
  const sessions = value?.sessions ?? [];

  useEffect(() => {
    if (!live || !serviceId) return;
    let current = true;
    const from = new Date();
    const to = new Date(from.getTime() + (days - 1) * 86_400_000);
    setState(previous => ({ status: 'loading', slots: previous.slots }));
    loader.current!(serviceId, isoDay(from), isoDay(to))
      .then(slots => {
        if (!current) return;
        setState({ status: 'ready', slots });
        const { value: chosen, onChange: update } = latest.current;
        const free = new Set(slots.map(slot => `${slot.date}|${slot.time}`));
        const kept = (chosen?.sessions ?? []).filter(session => free.has(`${session.date}|${session.time}`));
        if (chosen && kept.length !== chosen.sessions.length) {
          setDropped(true);
          update(kept.length ? { service: chosen.service, sessions: kept } : undefined);
        }
      })
      .catch(() => current && setState({ status: 'error', slots: [] }));
    return () => {
      current = false;
    };
  }, [live, serviceId, days, reloadKey, attempt]);

  if (!live) {
    return (
      <p id={inputId} className={`rounded-lg px-3 py-3 text-sm ${theme.button}`}>
        {t('booking_preview')}
      </p>
    );
  }

  const chooseCategory = (id: string) => {
    if (id === categoryId) return;
    setCategoryId(id);
    const inside = allServices.filter(item => item.category_id === id);
    setServiceId(inside.length === 1 ? inside[0].id : undefined);
    setDropped(false);
    setDays(STEP_DAYS);
    onChange(undefined);
  };

  const chooseService = (id: string) => {
    if (id === serviceId) return;
    setServiceId(id);
    setDropped(false);
    setDays(STEP_DAYS);
    onChange(undefined);
  };

  const toggle = (date: string, time: string) => {
    if (!serviceId) return;
    setDropped(false);
    const others = sessions.filter(session => session.date !== date);
    const same = sessions.some(session => session.date === date && session.time === time);
    const next = same ? others : [...others, { date, time }].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    onChange(next.length ? { service: serviceId, sessions: next } : undefined);
  };

  const byDay = new Map<string, FormSlot[]>();
  for (const slot of state.slots) byDay.set(slot.date, [...(byDay.get(slot.date) ?? []), slot]);
  const service = services.find(item => item.id === serviceId);
  const chip = (selected: boolean) =>
    `min-h-10 rounded-lg px-3 py-1.5 text-sm font-medium ${theme.button} ${selected ? 'ring-2 ring-current' : ''}`;

  return (
    <div id={inputId} className="space-y-4">
      {grouped && (
        <fieldset role="radiogroup" aria-label={t('booking_category')} className="space-y-2">
          {categories.map(item => {
            const count = allServices.filter(entry => entry.category_id === item.id).length;
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
                <span className="text-sm opacity-80">{t('booking_services_count', { count })}</span>
              </button>
            );
          })}
        </fieldset>
      )}
      {services.length > 1 ? (
        <fieldset role="radiogroup" aria-label={t('booking_service')} className="space-y-2">
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
                {item.price ? ` · ${formatCurrency(item.price, item.currency ?? 'EUR')}` : ''}
              </span>
            </button>
          ))}
        </fieldset>
      ) : (
        service && (
          <p className="text-sm font-medium">
            {service.name}
            <span className="font-normal opacity-80">
              {` · ${t('booking_minutes', { count: service.duration })}`}
              {service.price ? ` · ${formatCurrency(service.price, service.currency ?? 'EUR')}` : ''}
            </span>
          </p>
        )
      )}

      {serviceId && (
        <div className="space-y-3">
          {dropped && (
            <p role="alert" className="text-sm font-medium">
              {t('booking_taken')}
            </p>
          )}
          <p className="text-sm font-medium">{t('booking_pick')}</p>
          {state.status === 'error' ? (
            <div className="space-y-2">
              <p role="alert" className="text-sm">
                {t('booking_load_failed')}
              </p>
              <button type="button" className={chip(false)} onClick={() => setAttempt(count => count + 1)}>
                {t('booking_retry')}
              </button>
            </div>
          ) : (
            <>
              {state.status === 'loading' && state.slots.length === 0 && (
                <p className="text-sm opacity-80">{t('booking_loading')}</p>
              )}
              {state.status === 'ready' && byDay.size === 0 && (
                <p className="text-sm opacity-80">{t('booking_none')}</p>
              )}
              {[...byDay.entries()].map(([date, slots]) => (
                <div key={date} className="flex flex-wrap items-center gap-2">
                  <span className="w-24 shrink-0 text-sm font-medium">{dayLabel(date)}</span>
                  {slots.map(slot => {
                    const selected = sessions.some(session => session.date === date && session.time === slot.time);
                    return (
                      <button
                        key={slot.starts_at}
                        type="button"
                        aria-pressed={selected}
                        className={chip(selected)}
                        onClick={() => toggle(date, slot.time)}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
              ))}
              {days < MAX_DAYS && state.status === 'ready' && (
                <button type="button" className={`text-sm underline ${theme.footer}`} onClick={() => setDays(count => Math.min(MAX_DAYS, count + STEP_DAYS))}>
                  {t('booking_more_dates')}
                </button>
              )}
            </>
          )}
          {field.time_zone && <p className="text-xs opacity-70">{t('booking_zone', { zone: field.time_zone })}</p>}
        </div>
      )}

      {sessions.length > 0 && (
        <div className="rounded-lg border border-current/20 px-3 py-2 text-sm" aria-live="polite">
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
