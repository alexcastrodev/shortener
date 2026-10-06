import { Button } from '@mantine/core';
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconClock,
} from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../i18n/format';
import { monthDays } from '../../modules/agenda/agenda-layout.ts';

const WEEKDAYS = [
  '2026-10-05',
  '2026-10-06',
  '2026-10-07',
  '2026-10-08',
  '2026-10-09',
  '2026-10-10',
  '2026-10-11',
];

export type FormOption = { id: number; title: string; count: number };
export type CategoryOption = {
  id: string;
  name: string;
  count: number;
  color: string | null;
};

type Props = {
  anchor: string;
  today: string;
  weekDays: string[];
  withSessions: Set<string>;
  large: boolean;
  onPick: (day: string) => void;
  onMonth: (delta: -1 | 1) => void;
  pending: number;
  waitingOnly: boolean;
  onWaitingOnly: () => void;
  approveCount: number;
  approving: boolean;
  onApproveAll: () => void;
  forms: FormOption[];
  hiddenForms: Set<number>;
  onToggleForm: (id: number) => void;
  categories: CategoryOption[];
  hiddenCategories: Set<string>;
  onToggleCategory: (id: string) => void;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        className="flex min-h-11 w-full items-center justify-between rounded-md px-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary lg:min-h-9"
      >
        {title}
        {open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
      </button>
      {open && <ul className="mt-1 space-y-0.5">{children}</ul>}
    </section>
  );
}

function Option({
  checked,
  onChange,
  color,
  label,
  count,
  large,
}: {
  checked: boolean;
  onChange: () => void;
  color: string | null;
  label: string;
  count: number;
  large: boolean;
}) {
  return (
    <li>
      <label
        className={`flex cursor-pointer items-center gap-2.5 rounded-md px-1 text-sm ${large ? 'min-h-11' : 'min-h-9'}`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="size-4 shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          style={{ accentColor: color ?? 'var(--color-primary)' }}
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {count}
        </span>
      </label>
    </li>
  );
}

export function FiltersPanel(props: Props) {
  const { t } = useTranslation('agenda');
  const { anchor, today, weekDays, withSessions, large, forms, categories } =
    props;
  const cell = large ? 'h-11' : 'h-8';

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-medium first-letter:uppercase">
            {formatDate(`${anchor}T12:00:00Z`, {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </p>
          <div className="flex">
            <button
              type="button"
              aria-label={t('previous_month')}
              onClick={() => props.onMonth(-1)}
              className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary lg:size-8"
            >
              <IconChevronLeft size={16} />
            </button>
            <button
              type="button"
              aria-label={t('next_month')}
              onClick={() => props.onMonth(1)}
              className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary lg:size-8"
            >
              <IconChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 text-center" aria-hidden="true">
          {WEEKDAYS.map(day => (
            <span
              key={day}
              className="py-1 text-[11px] font-medium text-muted-foreground uppercase"
            >
              {formatDate(`${day}T12:00:00Z`, {
                weekday: 'narrow',
                timeZone: 'UTC',
              })}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {monthDays(anchor).map(({ date, inMonth }) => {
            const isToday = date === today;
            const isAnchor = date === anchor;
            const dotted = withSessions.has(date);
            return (
              <button
                key={date}
                type="button"
                aria-label={`${formatDate(`${date}T12:00:00Z`, { dateStyle: 'full', timeZone: 'UTC' })}${dotted ? `, ${t('has_sessions')}` : ''}`}
                aria-current={isToday ? 'date' : undefined}
                aria-pressed={isAnchor}
                onClick={() => props.onPick(date)}
                className={`relative flex ${cell} items-center justify-center text-sm focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-primary ${weekDays.includes(date) ? 'bg-primary/10' : ''} ${weekDays[0] === date ? 'rounded-l-full' : ''} ${weekDays[6] === date ? 'rounded-r-full' : ''} ${inMonth ? '' : 'text-muted-foreground'}`}
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground' : ''} ${isAnchor && !isToday ? 'ring-2 ring-primary' : ''}`}
                >
                  {Number(date.slice(8))}
                </span>
                {dotted && (
                  <span
                    aria-hidden="true"
                    className={`absolute bottom-0.5 size-1 rounded-full ${isToday ? 'bg-primary-foreground' : 'bg-primary'}`}
                    style={large ? undefined : { bottom: 1 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          aria-pressed={props.waitingOnly}
          onClick={props.onWaitingOnly}
          className={`flex w-full items-center gap-2 rounded-lg border px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary ${large ? 'min-h-11' : 'min-h-10'} ${props.waitingOnly ? 'border-amber-500 bg-amber-500/15' : 'border-border'}`}
        >
          <IconClock size={16} className="text-amber-600 dark:text-amber-400" />
          <span className="flex-1">{t('waiting_for_approval')}</span>
          <span className="rounded-full bg-amber-500/20 px-2 text-xs text-amber-900 tabular-nums dark:text-amber-300">
            {props.pending}
          </span>
        </button>
        {props.approveCount > 0 && (
          <Button
            fullWidth
            color="brand"
            className="min-h-11 lg:min-h-0"
            loading={props.approving}
            onClick={props.onApproveAll}
          >
            {t('approve_all', { count: props.approveCount })}
          </Button>
        )}
      </div>

      {forms.length > 0 && (
        <Section title={t('active_forms')}>
          {forms.map(form => (
            <Option
              key={form.id}
              large={large}
              checked={!props.hiddenForms.has(form.id)}
              onChange={() => props.onToggleForm(form.id)}
              color={null}
              label={form.title}
              count={form.count}
            />
          ))}
        </Section>
      )}

      {categories.length > 0 && (
        <Section title={t('categories')}>
          {categories.map(category => (
            <Option
              key={category.id}
              large={large}
              checked={!props.hiddenCategories.has(category.id)}
              onChange={() => props.onToggleCategory(category.id)}
              color={category.color}
              label={category.name}
              count={category.count}
            />
          ))}
        </Section>
      )}
    </div>
  );
}
