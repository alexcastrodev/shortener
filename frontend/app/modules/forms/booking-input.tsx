import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  BookingAnswer,
  BookingItem,
  FormField,
} from '@internal/core/types/Form';
import type { BioTheme } from '../bio-page/themes';
import { formatCurrency } from '../../i18n/format';
import type { JoinWaitlist } from './waitlist-join';
import { answerFrom, dropItem, itemsOf, setItem } from './booking-answer.ts';
import type { PickedSession } from './booking-calendar.ts';
import {
  cheapestPrice,
  hasSeveralDurations,
  monthlyMinutes,
} from './booking-options.ts';
import { monthlyDates } from './monthly-booking';
import { ServiceBlock, type LoadSlots } from './service-block.tsx';

export type { JoinWaitlist, LoadSlots };

export function BookingInput({
  field,
  value,
  onChange,
  theme,
  inputId,
  loadSlots,
  joinWaitlist,
  reloadKey,
  hideSummary,
  preselect,
}: {
  field: FormField;
  value: BookingAnswer | undefined;
  onChange: (value: BookingAnswer | undefined) => void;
  theme: BioTheme;
  inputId: string;
  loadSlots?: LoadSlots;
  joinWaitlist?: JoinWaitlist;
  reloadKey?: string;
  hideSummary?: boolean;
  preselect?: boolean | string;
}) {
  const { t } = useTranslation('respond');
  const allServices = field.services ?? [];
  const categories = field.categories ?? [];
  const grouped = categories.length >= 2;
  const multiple =
    !grouped && (field.multiple_services ?? field.rules?.multiple_services) === true;
  const items = itemsOf(value);
  const preselected =
    allServices.find(item => item.id === preselect) ?? allServices[0];
  const [categoryId, setCategoryId] = useState<string | undefined>(
    allServices.find(item => item.id === items[0]?.service)?.category_id ??
      (preselect && grouped ? preselected?.category_id : undefined) ??
      undefined
  );
  const services = grouped
    ? allServices.filter(item => item.category_id === categoryId)
    : allServices;
  const [selected, setSelected] = useState<string[]>(() => {
    const given = items.map(item => item.service);
    if (multiple && given.length > 0) return given;
    const first =
      given[0] ??
      (!grouped && services.length === 1 ? services[0].id : undefined) ??
      (preselect ? preselected?.id : undefined);
    return first ? [first] : [];
  });

  useEffect(() => {
    if (typeof preselect !== 'string') return;
    const wanted = allServices.find(item => item.id === preselect);
    if (!wanted) return;
    setCategoryId(wanted.category_id ?? undefined);
    setSelected([wanted.id]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect]);

  const several = multiple && services.length > 1;
  const current = useRef({ items, onChange, selected, several });
  current.current = { items, onChange, selected, several };

  const setServiceItem = (service: string, item: BookingItem | undefined) => {
    const { several: tracked, selected: ticked } = current.current;
    const kept =
      item ?? (tracked && ticked.includes(service) ? { service, sessions: [] } : undefined);
    const next = kept
      ? setItem(current.current.items, kept)
      : dropItem(current.current.items, service);
    current.current.items = next;
    current.current.onChange(answerFrom(next, multiple));
  };

  const chooseCategory = (id: string) => {
    if (id === categoryId) return;
    setCategoryId(id);
    const inside = allServices.filter(item => item.category_id === id);
    setSelected(inside.length === 1 ? [inside[0].id] : []);
    onChange(undefined);
  };

  const chooseService = (id: string) => {
    if (multiple) {
      const ticked = selected.includes(id);
      const after = ticked ? selected.filter(entry => entry !== id) : [...selected, id];
      setSelected(after);
      current.current.selected = after;
      if (ticked) setServiceItem(id, undefined);
      else setServiceItem(id, { service: id, sessions: [] });
      return;
    }
    if (selected[0] === id) return;
    setSelected([id]);
    onChange(undefined);
  };

  const chosen = services.filter(item => selected.includes(item.id));
  const priceText = (price: number | null | undefined, currency?: string | null) =>
    price ? formatCurrency(price, currency ?? 'EUR') : null;
  const othersOf = (service: string): PickedSession[] =>
    items
      .filter(item => item.service !== service)
      .flatMap(item => {
        const other = allServices.find(entry => entry.id === item.service);
        if (!other) return [];
        if (item.monthly)
          return monthlyDates(
            item.monthly.month,
            item.monthly.weekdays,
            new Date()
          ).map(date => ({
            date,
            time: item.monthly!.time,
            duration: monthlyMinutes(other),
            service: other.name,
          }));
        return item.sessions.map(session => ({
          date: session.date,
          time: session.time,
          duration: session.duration ?? other.duration,
          service: other.name,
        }));
      });

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
          role={multiple ? 'group' : 'radiogroup'}
          aria-label={t(multiple ? 'booking_services_pick' : 'booking_service')}
          className="space-y-2"
        >
          {services.map(item => (
            <button
              key={item.id}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={selected.includes(item.id)}
              onClick={() => chooseService(item.id)}
              className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${theme.button} ${selected.includes(item.id) ? 'ring-2 ring-current' : ''}`}
            >
              <span className="font-medium">{item.name}</span>
              <span className="text-sm opacity-80">
                {hasSeveralDurations(item)
                  ? [
                      t('booking_from'),
                      priceText(cheapestPrice(item), item.currency),
                    ]
                      .filter(Boolean)
                      .join(' ')
                  : t('booking_minutes', { count: item.duration })}
                {!hasSeveralDurations(item) && item.price
                  ? ` · ${formatCurrency(item.price, item.currency ?? 'EUR')}`
                  : ''}
              </span>
            </button>
          ))}
        </fieldset>
      ) : (
        chosen[0] && (
          <p className="text-sm font-medium">
            {chosen[0].name}
            {!chosen[0].monthly && !hasSeveralDurations(chosen[0]) && (
              <span className="font-normal opacity-80">
                {` · ${t('booking_minutes', { count: chosen[0].duration })}`}
                {chosen[0].price
                  ? ` · ${formatCurrency(chosen[0].price, chosen[0].currency ?? 'EUR')}`
                  : ''}
              </span>
            )}
          </p>
        )
      )}

      {chosen.map(service => (
        <ServiceBlock
          key={service.id}
          field={field}
          service={service}
          item={items.find(item => item.service === service.id)}
          others={othersOf(service.id)}
          onItem={item => setServiceItem(service.id, item)}
          theme={theme}
          inputId={inputId}
          loadSlots={loadSlots}
          joinWaitlist={joinWaitlist}
          reloadKey={reloadKey}
          hideSummary={hideSummary}
          multiple={several}
        />
      ))}
    </div>
  );
}
