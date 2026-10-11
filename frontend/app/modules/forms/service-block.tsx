import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  BookingItem,
  FormField,
  MonthlyPattern,
} from '@internal/core/types/Form';
import type { BioTheme } from '../bio-page/themes';
import { formatCurrency, formatDate } from '../../i18n/format';
import type { JoinWaitlist } from './waitlist-join';
import { isPlan } from './booking-answer.ts';
import {
  bufferOf,
  monthOf,
  monthlyClash,
  type PickedSession,
} from './booking-calendar.ts';
import { BookingNote } from './booking-note.tsx';
import {
  allowanceOf,
  cheapestPrice,
  durationText,
  hasSeveralDurations,
  monthlyMinutes,
  type Allowance,
} from './booking-options.ts';
import { useDurationWords } from './use-duration-words.ts';
import { usePlanWords } from './use-plan-words.ts';
import {
  WEEKDAYS,
  monthOptions,
  monthlyComplete,
  monthlyDates,
  toggleWeekday,
} from './monthly-booking';
import { usePickerMemory, type PickerMemory } from './picker-memory.ts';
import { SessionPicker, type LoadSlots } from './session-picker.tsx';

export type { LoadSlots };

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
  const sessions = item?.sessions ?? [];
  const monthly = item?.monthly;
  const allowance = allowanceOf(service);
  const daysMemory = usePickerMemory(monthOf(new Date()), true);
  const planMemory = usePickerMemory(
    monthly && isPlan(monthly) ? monthly.month : monthOptions(new Date())[0].value,
    false
  );

  const chooseMode = (next: 'days' | 'monthly') => {
    if (next === mode) return;
    setMode(next);
    onItem(undefined);
  };

  const several = hasSeveralDurations(service);
  const chip = (selected: boolean, size = 'text-sm!') =>
    `min-h-11 rounded-lg px-3 py-1.5 ${size} font-medium! ${theme.button} ${selected ? 'ring-2 ring-current' : ''}`;
  const modeId = `${inputId}-${serviceId}-mode`;
  const modeCard = (selected: boolean) =>
    `flex min-w-0 flex-col gap-1 rounded-xl p-4 text-left ${theme.button} ${selected ? 'ring-2 ring-current' : ''}`;

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
                {allowance
                  ? t(
                      allowance.per === 'week'
                        ? 'booking_mode_plan_week'
                        : 'booking_mode_plan_month',
                      {
                        count: allowance.limit,
                        duration: durationText(
                          monthlyMinutes(service),
                          durationWords
                        ),
                      }
                    )
                  : t('booking_mode_monthly_desc', {
                      duration: durationText(
                        monthlyMinutes(service),
                        durationWords
                      ),
                    })}
              </span>
            </button>
          </fieldset>
        </div>
      )}

      {mode === 'monthly' && !allowance && (
        <MonthlyPicker
          service={service}
          value={monthly && !isPlan(monthly) ? monthly : undefined}
          others={others}
          buffer={bufferOf(field)}
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

      {mode === 'monthly' && allowance && (
        <PlanPicker
          field={field}
          service={service}
          allowance={allowance}
          memory={planMemory}
          picks={monthly && isPlan(monthly) ? monthly.sessions : []}
          others={others}
          onItem={onItem}
          theme={theme}
          chip={chip}
          loadSlots={loadSlots}
          reloadKey={reloadKey}
          hideSummary={hideSummary}
          named={multiple}
        />
      )}

      {mode === 'days' && (
        <SessionPicker
          field={field}
          service={service}
          picks={sessions}
          onPicks={picks =>
            onItem(
              picks.length ? { service: serviceId, sessions: picks } : undefined
            )
          }
          others={others}
          theme={theme}
          chip={chip}
          loadSlots={loadSlots}
          joinWaitlist={joinWaitlist}
          reloadKey={reloadKey}
          hideSummary={hideSummary}
          memory={daysMemory}
          named={multiple}
        />
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

function MonthChips({
  value,
  chip,
  onChange,
}: {
  value: string;
  chip: (selected: boolean) => string;
  onChange: (month: string) => void;
}) {
  const { t } = useTranslation('respond');
  return (
    <>
      <p className="text-sm font-medium">{t('monthly_month')}</p>
      <div className="flex flex-wrap gap-2">
        {monthOptions(new Date()).map(item => (
          <button
            key={item.value}
            type="button"
            aria-pressed={value === item.value}
            className={chip(value === item.value)}
            onClick={() => onChange(item.value)}
          >
            {formatDate(item.date.toISOString(), {
              month: 'long',
              year: 'numeric',
            })}
          </button>
        ))}
      </div>
    </>
  );
}

function PlanPicker({
  field,
  service,
  allowance,
  memory,
  picks,
  others,
  onItem,
  theme,
  chip,
  loadSlots,
  reloadKey,
  hideSummary,
  named,
}: {
  field: FormField;
  service: Service;
  allowance: Allowance;
  memory: PickerMemory;
  picks: { date: string; time: string }[];
  others: PickedSession[];
  onItem: (item: BookingItem | undefined) => void;
  theme: BioTheme;
  chip: (selected: boolean, size?: string) => string;
  loadSlots?: LoadSlots;
  reloadKey?: string;
  hideSummary?: boolean;
  named: boolean;
}) {
  const plan = usePlanWords();
  const month = memory.month;

  const chooseMonth = (next: string) => {
    if (next === month) return;
    memory.setMonth(next);
    onItem(undefined);
  };

  return (
    <div className="space-y-3">
      <MonthChips value={month} chip={chip} onChange={chooseMonth} />
      <p aria-live="polite" className="text-sm font-medium">
        {plan.counter(allowance, picks.length)}
      </p>
      <SessionPicker
        field={field}
        service={service}
        picks={picks}
        onPicks={next =>
          onItem(
            next.length
              ? {
                  service: service.id,
                  sessions: [],
                  monthly: {
                    month,
                    sessions: next.map(({ date, time }) => ({ date, time })),
                  },
                }
              : undefined
          )
        }
        others={others}
        theme={theme}
        chip={chip}
        loadSlots={loadSlots}
        reloadKey={reloadKey}
        hideSummary={hideSummary}
        memory={memory}
        month={month}
        duration={monthlyMinutes(service)}
        cap={allowance}
        named={named}
      />
    </div>
  );
}

function MonthlyPicker({
  service,
  value,
  others,
  buffer,
  theme,
  chip,
  onChange,
}: {
  service: Service;
  value: MonthlyPattern | undefined;
  others: PickedSession[];
  buffer: number;
  theme: BioTheme;
  chip: (selected: boolean) => string;
  onChange: (choice: MonthlyPattern | undefined) => void;
}) {
  const { t } = useTranslation('respond');
  const durationWords = useDurationWords();
  const months = monthOptions(new Date());
  const times = [...service.times].sort();
  const [draft, setDraft] = useState<MonthlyPattern>(
    value ?? { month: months[0].value, weekdays: [], time: times[0] ?? '' }
  );
  const [clash, setClash] = useState<PickedSession>();
  const update = (next: Partial<MonthlyPattern>) => {
    const merged = { ...draft, ...next };
    const found = monthlyComplete(merged)
      ? monthlyClash(merged, monthlyMinutes(service), others, buffer, new Date())
      : undefined;
    setClash(found);
    if (found) return;
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
      <MonthChips
        value={shown.month}
        chip={chip}
        onChange={month => update({ month })}
      />
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
      <BookingNote
        warning
        message={
          clash
            ? t('booking_note_overlap_service', {
                service: clash.service,
                what: clash.time,
              })
            : undefined
        }
      />
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
