import { Button, Drawer, SegmentedControl } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconAdjustmentsHorizontal,
  IconChevronLeft,
  IconChevronRight,
  IconX,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Card, PageContainer } from '@internal/ui';
import {
  getAgendaKey,
  useGetAgenda,
} from '@internal/core/actions/get-agenda/get-agenda.hook';
import { useAppointmentAction } from '@internal/core/actions/appointment-action/appointment-action.hook';
import type { AgendaSession } from '@internal/core/actions/get-agenda/get-agenda.types';
import { useUserState } from '@internal/core/states/use-user-state';
import { formatDate } from '../../i18n/format';
import {
  HOUR_PX,
  NO_CATEGORY,
  addMonths,
  categoryColors,
  categoryOf,
  clock,
  datesWithSessions,
  dayBlocks,
  minutesOfDay,
  monthRange,
  neighbour,
  pendingTotal,
  rangeFor,
  sessionsByDay,
  step,
  todayIn,
  type Block,
  type Direction,
  type NavBlock,
  type View,
} from '../../modules/agenda/agenda-layout.ts';
import { FiltersPanel } from './filters-panel';
import { SessionPanel } from './session-panel';
import {
  onlyPending,
  pendingTargets,
} from '../../modules/agenda/agenda-actions.ts';
import type { Route } from './+types/index';

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Agenda - Kurz' }];
}

export const ssr = false;

const keyOf = (session: AgendaSession) =>
  `${session.form_id}:${session.service_id}:${session.starts_at}`;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const ARROWS: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};
const GUTTER = 'w-12 shrink-0 sm:w-14';

export default function AgendaPage() {
  const { t } = useTranslation('agenda');
  const user = useUserState(state => state.user);
  const fallbackZone = user?.time_zone ?? 'UTC';
  const isPhone = useMediaQuery('(max-width: 639px)', false, {
    getInitialValueInEffect: false,
  });
  const isWide = useMediaQuery('(min-width: 1024px)', false, {
    getInitialValueInEffect: false,
  });
  const isXl = useMediaQuery('(min-width: 1536px)', false, {
    getInitialValueInEffect: false,
  });
  const [chosenView, setView] = useState<View>('week');
  const view: View = isPhone ? 'day' : chosenView;
  const [anchor, setAnchor] = useState(() => todayIn(fallbackZone));
  const [selected, setSelected] = useState<string | null>(null);
  const [waitingOnly, setWaitingOnly] = useState(false);
  const [hiddenForms, setHiddenForms] = useState<Set<number>>(new Set());
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(
    new Set()
  );
  const [sheet, setSheet] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { mutateAsync: act, isPending: approving } = useAppointmentAction();
  const [now, setNow] = useState(() => new Date());
  const scroller = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  const lastChosen = useRef<AgendaSession | null>(null);

  const { from: monthFrom, to: monthTo } = monthRange(anchor);
  const { from, to, days } = rangeFor(view, anchor);
  const week = rangeFor('week', anchor).days;
  const { data, error, isLoading } = useGetAgenda(monthFrom, monthTo);
  const zone = data?.time_zone ?? fallbackZone;
  const today = todayIn(zone, now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (scrolled.current || !scroller.current || !data) return;
    scrolled.current = true;
    scroller.current.scrollTop = Math.max(
      0,
      (minutesOfDay(now, zone) / 60 - 2) * HOUR_PX
    );
  }, [data, now, zone]);

  useEffect(() => {
    if (!selected || !isXl) return;
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role=dialog]'))
        setSelected(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [selected, isXl]);

  const all = data?.sessions ?? [];
  const colors = useMemo(() => categoryColors(all), [all]);
  const inRange = useMemo(
    () => all.filter(session => session.date >= from && session.date <= to),
    [all, from, to]
  );
  const allowed = (session: AgendaSession) =>
    !hiddenForms.has(session.form_id) &&
    !hiddenCategories.has(categoryOf(session));

  const forms = useMemo(() => {
    const seen = new Map<number, { title: string; count: number }>();
    for (const session of all) {
      const entry = seen.get(session.form_id) ?? {
        title: session.form_title,
        count: 0,
      };
      if (session.date >= from && session.date <= to) entry.count += 1;
      seen.set(session.form_id, entry);
    }
    return [...seen].map(([id, entry]) => ({ id, ...entry }));
  }, [all, from, to]);

  const categories = useMemo(() => {
    const seen = new Map<string, { name: string; count: number }>();
    for (const session of all) {
      const id = categoryOf(session);
      if (id === NO_CATEGORY) continue;
      const entry = seen.get(id) ?? {
        name: session.category?.name ?? '',
        count: 0,
      };
      if (session.date >= from && session.date <= to) entry.count += 1;
      seen.set(id, entry);
    }
    return [...seen].map(([id, entry]) => ({
      id,
      ...entry,
      color: colors.get(id) ?? null,
    }));
  }, [all, from, to, colors]);

  const scoped = useMemo(
    () => inRange.filter(allowed),
    [inRange, hiddenForms, hiddenCategories]
  );
  const visible = useMemo(
    () => (waitingOnly ? onlyPending(scoped) : scoped),
    [scoped, waitingOnly]
  );
  const withSessions = useMemo(
    () => datesWithSessions(all.filter(allowed)),
    [all, hiddenForms, hiddenCategories]
  );
  const byDay = useMemo(() => sessionsByDay(visible, null), [visible]);
  const columns = useMemo(
    () => days.map(day => dayBlocks(byDay.get(day) ?? [], zone)),
    [days, byDay, zone]
  );
  const navBlocks = useMemo<NavBlock[]>(
    () =>
      columns.flatMap((column, index) =>
        column.map(block => ({
          id: keyOf(block.session),
          day: days[index],
          start: block.top,
          lane: block.lane,
        }))
      ),
    [columns, days]
  );
  const chosen = visible.find(session => keyOf(session) === selected) ?? null;
  if (chosen) lastChosen.current = chosen;
  const pending = pendingTotal(scoped);
  const targets = useMemo(() => pendingTargets(scoped), [scoped]);
  const activeFilters =
    (waitingOnly ? 1 : 0) + hiddenForms.size + hiddenCategories.size;
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getAgendaKey });
  const approveAll = async () => {
    const results = await Promise.allSettled(
      targets.map(target => act({ id: target.id, action: 'approve' }))
    );
    const done = results.filter(result => result.status === 'fulfilled').length;
    notifications.show({
      message:
        done === targets.length
          ? t('done_approve_all', { count: done })
          : t('err_unknown'),
      color: done === targets.length ? 'teal' : 'red',
    });
    refresh();
  };

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (!next.delete(value)) next.add(value);
    return next;
  };

  const label =
    view === 'day'
      ? formatDate(`${anchor}T12:00:00Z`, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          ...(isPhone ? {} : { year: 'numeric' }),
          timeZone: 'UTC',
        })
      : `${formatDate(`${from}T12:00:00Z`, { day: 'numeric', month: 'short', timeZone: 'UTC' })} – ${formatDate(`${to}T12:00:00Z`, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`;

  const occupancyText = (session: AgendaSession) =>
    session.capacity === null
      ? t('booked_unlimited', { count: session.booked })
      : session.booked === 0
        ? t('free')
        : t('booked_of', {
            booked: session.booked,
            capacity: session.capacity,
          });

  const focusBlock = (id: string) => {
    const target = document.querySelector<HTMLElement>(
      `[data-block="${CSS.escape(id)}"]`
    );
    target?.focus();
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = ARROWS[event.key];
    const id = (event.target as HTMLElement).dataset.block;
    if (!direction || !id) return;
    event.preventDefault();
    const next = neighbour(navBlocks, id, direction);
    if (next) focusBlock(next);
  };

  const pick = (day: string) => {
    setAnchor(day);
    setSelected(null);
  };

  const onStripKey = (event: KeyboardEvent<HTMLElement>, day: string) => {
    const delta =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const index = week.indexOf(day) + delta;
    const next = week[index];
    if (!next) return;
    pick(next);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-strip="${next}"]`)?.focus()
    );
  };

  const filtersProps = {
    anchor,
    today,
    weekDays: week,
    withSessions,
    onPick: pick,
    onMonth: (delta: -1 | 1) => pick(addMonths(anchor, delta)),
    pending,
    waitingOnly,
    onWaitingOnly: () => setWaitingOnly(value => !value),
    approveCount: targets.length,
    approving,
    onApproveAll: approveAll,
    forms,
    hiddenForms,
    onToggleForm: (id: number) => setHiddenForms(set => toggle(set, id)),
    categories,
    hiddenCategories,
    onToggleCategory: (id: string) =>
      setHiddenCategories(set => toggle(set, id)),
  };

  const renderBlock = (block: Block) => {
    const session = block.session;
    const id = keyOf(session);
    const isSelected = id === selected;
    const color = colors.get(categoryOf(session)) ?? 'var(--color-primary)';
    const compact = block.height < 44;
    const time = clock(minutesOfDay(session.starts_at, zone));
    const name = session.service_name ?? t('service_fallback');
    const pendingText =
      session.pending > 0 ? t('pending', { count: session.pending }) : '';
    return (
      <button
        key={id}
        type="button"
        data-block={id}
        aria-pressed={isSelected}
        aria-label={[name, time, occupancyText(session), pendingText]
          .filter(Boolean)
          .join(', ')}
        onClick={() => setSelected(isSelected ? null : id)}
        className={`absolute overflow-hidden rounded-md border px-1.5 py-1 text-left text-xs focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foreground ${session.pending > 0 ? 'border-dashed' : ''} ${isSelected ? 'z-10 ring-2 ring-foreground/70' : ''}`}
        style={{
          top: block.top,
          height: block.height,
          left: `calc(${(block.lane / block.lanes) * 100}% + 2px)`,
          width: `calc(${100 / block.lanes}% - 4px)`,
          background: `color-mix(in srgb, ${color} ${isSelected ? 34 : 18}%, var(--color-background))`,
          borderColor: `color-mix(in srgb, ${color} ${isSelected ? 100 : 44}%, transparent)`,
        }}
      >
        <span
          className={`block truncate font-semibold ${compact ? 'leading-none' : ''}`}
        >
          {name}
          {compact && (
            <span className="ml-1 text-[11px] font-normal text-foreground/75">
              {occupancyText(session)}
              {pendingText ? ` · ${pendingText}` : ''}
            </span>
          )}
        </span>
        {!compact && (
          <span className="block truncate text-[11px] text-foreground/75">
            {time} · {occupancyText(session)}
            {pendingText ? ` · ${pendingText}` : ''}
          </span>
        )}
      </button>
    );
  };

  const panel = lastChosen.current && (
    <SessionPanel
      session={lastChosen.current}
      zone={zone}
      inline={isXl}
      phone={isPhone}
      onClose={() => setSelected(null)}
      onChanged={refresh}
      onDialog={setDialogOpen}
    />
  );

  return (
    <PageContainer className="py-3 sm:py-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="sr-only mr-2 text-2xl font-semibold tracking-tight md:not-sr-only">
          {t('title')}
        </h1>
        <Button
          variant="default"
          className="min-h-11 lg:min-h-0"
          onClick={() => pick(todayIn(zone))}
        >
          {t('today')}
        </Button>
        <div className="flex">
          <button
            type="button"
            aria-label={t('previous')}
            onClick={() => pick(step(view, anchor, -1))}
            className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary lg:size-9"
          >
            <IconChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label={t('next')}
            onClick={() => pick(step(view, anchor, 1))}
            className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary lg:size-9"
          >
            <IconChevronRight size={18} />
          </button>
        </div>
        {!isWide && (
          <Button
            variant="default"
            className="ml-auto min-h-11"
            leftSection={<IconAdjustmentsHorizontal size={16} />}
            onClick={() => setSheet(true)}
          >
            {t('filters')}
            {activeFilters > 0 && (
              <span className="ml-2 rounded-full bg-amber-500/20 px-1.5 text-xs tabular-nums">
                {activeFilters}
              </span>
            )}
          </Button>
        )}
        <div className="order-last flex w-full items-baseline justify-between gap-2 sm:contents">
          <p
            aria-live="polite"
            className="text-lg font-semibold first-letter:uppercase md:text-sm md:font-medium"
          >
            {label}
          </p>
          <p className="text-xs text-muted-foreground sm:ml-auto">
            {t('sessions', { count: visible.length })}
          </p>
        </div>
        {!isPhone && (
          <SegmentedControl
            aria-label={t('view_label')}
            value={view}
            onChange={value => setView(value as View)}
            data={[
              { value: 'week', label: t('view_week') },
              { value: 'day', label: t('view_day') },
            ]}
          />
        )}
      </div>

      {error && <Alert title={t('title')}>{t('error')}</Alert>}

      <div className="flex gap-4">
        {isWide && (
          <aside className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] w-56 shrink-0 self-start overflow-y-auto lg:block xl:w-64">
            <FiltersPanel {...filtersProps} large={false} />
          </aside>
        )}

        <Card className="min-w-0 flex-1 overflow-hidden p-0">
          {isPhone && (
            <div
              role="group"
              aria-label={t('week_days')}
              className="flex border-b border-border"
            >
              {week.map(day => {
                const isAnchor = day === anchor;
                return (
                  <button
                    key={day}
                    type="button"
                    data-strip={day}
                    aria-pressed={isAnchor}
                    aria-current={day === today ? 'date' : undefined}
                    aria-label={`${formatDate(`${day}T12:00:00Z`, { dateStyle: 'full', timeZone: 'UTC' })}${withSessions.has(day) ? `, ${t('has_sessions')}` : ''}`}
                    onClick={() => pick(day)}
                    onKeyDown={event => onStripKey(event, day)}
                    className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span
                      className={`flex w-full flex-col items-center rounded-lg py-1.5 ${isAnchor ? 'bg-primary text-primary-foreground' : ''}`}
                    >
                      <span
                        className={`text-[11px] uppercase ${isAnchor ? '' : 'text-muted-foreground'}`}
                      >
                        {formatDate(`${day}T12:00:00Z`, {
                          weekday: 'short',
                          timeZone: 'UTC',
                        })
                          .replace('.', '')
                          .slice(0, 3)}
                      </span>
                      <span
                        className={`text-base font-medium ${day === today && !isAnchor ? 'text-primary' : ''}`}
                      >
                        {Number(day.slice(8))}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`size-1 rounded-full ${withSessions.has(day) ? 'bg-primary' : ''}`}
                    />
                  </button>
                );
              })}
            </div>
          )}
          {!isPhone && (
            <div className="flex border-b border-border">
              <div className={GUTTER} />
              {days.map(day => (
                <div
                  key={day}
                  className="min-w-0 flex-1 border-l border-border py-2 text-center"
                >
                  <p
                    className={`text-[11px] font-medium uppercase ${day === today ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    {formatDate(`${day}T12:00:00Z`, {
                      weekday: 'short',
                      timeZone: 'UTC',
                    })}
                  </p>
                  <p
                    className={`mx-auto mt-0.5 flex size-8 items-center justify-center rounded-full text-sm ${day === today ? 'bg-primary text-primary-foreground' : ''}`}
                  >
                    {Number(day.slice(8))}
                  </p>
                </div>
              ))}
            </div>
          )}
          {!isLoading && visible.length === 0 && (
            <p className="border-b border-border p-3 text-center text-sm text-muted-foreground">
              {t('empty')}
            </p>
          )}
          <div
            ref={scroller}
            onKeyDown={onGridKey}
            className="relative max-h-[calc(100dvh-20rem)] min-h-80 overflow-y-auto lg:max-h-[calc(100dvh-14rem)]"
          >
            {isLoading && (
              <div className="absolute inset-0 z-30 animate-pulse bg-muted/60" />
            )}
            <div className="relative flex" style={{ height: 24 * HOUR_PX }}>
              <div className={GUTTER}>
                {HOURS.map(hour => (
                  <div
                    key={hour}
                    className="relative pr-2 text-right font-mono text-[10.5px] text-muted-foreground"
                    style={{ height: HOUR_PX }}
                  >
                    {hour === 0 ? null : (
                      <span className="absolute right-2 -top-2">
                        {clock(hour * 60)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {days.map((day, index) => (
                <div
                  key={day}
                  className={`relative min-w-0 flex-1 border-l border-border ${day === today ? 'bg-primary/5' : ''}`}
                >
                  {HOURS.map(hour => (
                    <div
                      key={hour}
                      className="border-b border-border/60"
                      style={{ height: HOUR_PX }}
                    />
                  ))}
                  {columns[index].map(renderBlock)}
                  {day === today && (
                    <div
                      role="img"
                      aria-label={`${t('now')} ${clock(minutesOfDay(now, zone))}`}
                      className="pointer-events-none absolute right-0 left-0 z-20 h-0.5 bg-red-600"
                      style={{ top: (minutesOfDay(now, zone) / 60) * HOUR_PX }}
                    >
                      <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-red-600" />
                      <span
                        aria-hidden="true"
                        className="absolute right-0 bottom-0.5 rounded-sm bg-red-600 px-1 font-mono text-[10px] text-white"
                      >
                        {clock(minutesOfDay(now, zone))}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {isXl && chosen && panel}
      </div>

      {!isWide && (
        <Drawer
          opened={sheet}
          onClose={() => setSheet(false)}
          position="bottom"
          size="90%"
          title={t('filters')}
          closeButtonProps={{ 'aria-label': t('panel_close') }}
          classNames={{ close: 'min-h-11 min-w-11' }}
          styles={{ header: { background: 'transparent' } }}
        >
          <FiltersPanel {...filtersProps} large />
        </Drawer>
      )}

      {!isXl && (
        <Drawer
          opened={!!chosen}
          closeOnEscape={!dialogOpen}
          onClose={() => setSelected(null)}
          position={isPhone ? 'bottom' : 'right'}
          size={isPhone ? '90%' : 400}
          title={lastChosen.current?.service_name ?? t('service_fallback')}
          closeButtonProps={{ 'aria-label': t('panel_close') }}
          classNames={{ close: 'min-h-11 min-w-11' }}
          styles={{ header: { background: 'transparent' } }}
        >
          {panel}
        </Drawer>
      )}
    </PageContainer>
  );
}
