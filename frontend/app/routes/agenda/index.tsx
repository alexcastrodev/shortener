import { Button, Drawer, SegmentedControl } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconAdjustmentsHorizontal,
  IconChevronLeft,
  IconArrowsMaximize,
  IconArrowsMinimize,
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
import { Alert, Card } from '@internal/ui';
import {
  getAgendaKey,
  useGetAgenda,
} from '@internal/core/actions/get-agenda/get-agenda.hook';
import { useAppointmentAction } from '@internal/core/actions/appointment-action/appointment-action.hook';
import { useGetMyBookings } from '@internal/core/actions/get-my-bookings/get-my-bookings.hook';
import type {
  AgendaAppointment,
  AgendaSession,
} from '@internal/core/actions/get-agenda/get-agenda.types';
import { useUserState } from '@internal/core/states/use-user-state';
import { formatDate } from '../../i18n/format';
import {
  NO_CATEGORY,
  addMonths,
  categoryColors,
  categoryOf,
  clock,
  datesWithSessions,
  minutesOfDay,
  monthRange,
  pendingTotal,
  rangeFor,
  sessionsByDay,
  step,
  todayIn,
  type View,
} from '../../modules/agenda/agenda-layout.ts';
import {
  keyOf,
  mySlots,
  type MySlot,
} from '../../modules/agenda/schedule-events.ts';
import { AgendaCalendar } from './agenda-calendar';
import { FiltersPanel } from './filters-panel';
import {
  MyBookingPanel,
  SessionPanel,
  agendaErrorText,
} from './session-panel';
import {
  onlyPending,
  pendingTargets,
} from '../../modules/agenda/agenda-actions.ts';
import type { Route } from './+types/index';

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Agenda - Kurz' }];
}

export const ssr = false;

// Bottom sheets keep their last row above the home indicator.
const SHEET_STYLES = {
  header: { background: 'transparent' },
  body: {
    paddingBottom: 'max(var(--mb-padding, 1rem), env(safe-area-inset-bottom))',
  },
};

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
  const [showMine, setShowMine] = useState(true);
  const [hiddenForms, setHiddenForms] = useState<Set<number>>(new Set());
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(
    new Set()
  );
  const [sheet, setSheet] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { mutateAsync: act, isPending: approving } = useAppointmentAction();
  const [now, setNow] = useState(() => new Date());
  const lastChosen = useRef<AgendaSession | MySlot | null>(null);

  const { from: monthFrom, to: monthTo } = monthRange(anchor);
  const { from, to, days } = rangeFor(view, anchor);
  const week = rangeFor('week', anchor).days;
  const { data, error, isLoading } = useGetAgenda(monthFrom, monthTo);
  const { data: myBookings } = useGetMyBookings(monthFrom, monthTo);
  const zone = data?.time_zone ?? fallbackZone;
  const today = todayIn(zone, now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selected || !isXl) return;
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role=dialog]'))
        setSelected(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [selected, isXl]);

  useEffect(() => {
    if (!expanded || selected) return;
    const shrink = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role=dialog]'))
        setExpanded(false);
    };
    window.addEventListener('keydown', shrink);
    return () => window.removeEventListener('keydown', shrink);
  }, [expanded, selected]);

  const all = data?.sessions ?? [];
  const colors = useMemo(() => categoryColors(all), [all]);
  const inRange = useMemo(
    () => all.filter(session => session.date >= from && session.date <= to),
    [all, from, to]
  );
  const allMine = useMemo(
    () => mySlots(myBookings?.bookings ?? [], zone),
    [myBookings, zone]
  );
  const mineInRange = useMemo(
    () => allMine.filter(slot => slot.date >= from && slot.date <= to),
    [allMine, from, to]
  );
  const mine = useMemo(
    () => (showMine ? mineInRange : []),
    [mineInRange, showMine]
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
    () =>
      new Set([
        ...datesWithSessions(all.filter(allowed)),
        ...(showMine ? allMine.map(slot => slot.date) : []),
      ]),
    [all, hiddenForms, hiddenCategories, showMine, allMine]
  );
  const byDay = useMemo(() => sessionsByDay(visible, null), [visible]);
  const chosen =
    visible.find(session => keyOf(session) === selected) ??
    mine.find(slot => slot.key === selected) ??
    null;
  if (chosen) lastChosen.current = chosen;
  const last = lastChosen.current;
  const pending = pendingTotal(scoped);
  const targets = useMemo(() => pendingTargets(scoped), [scoped]);
  const activeFilters =
    (waitingOnly ? 1 : 0) +
    (showMine ? 0 : 1) +
    hiddenForms.size +
    hiddenCategories.size;
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getAgendaKey });
  const clientsOf = (session: AgendaSession) =>
    session.appointments.filter(item => item.status !== 'unverified');
  const move = async (
    from: AgendaSession,
    to: { date: string; time: string }
  ) => {
    let failure: unknown = null;
    for (const client of clientsOf(from)) {
      try {
        await act({
          id: client.id,
          action: 'reschedule',
          data: { ...to, force: true },
        });
      } catch (error) {
        failure ??= error;
      }
    }
    notifications.show(
      failure
        ? { message: agendaErrorText(t, failure), color: 'red' }
        : { message: t('done_move'), color: 'teal' }
    );
    refresh();
  };
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
    view === 'month'
      ? formatDate(`${anchor}T12:00:00Z`, {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : view === 'day'
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
    showMine,
    onShowMine: () => setShowMine(value => !value),
    mineCount: mineInRange.length,
    forms,
    hiddenForms,
    onToggleForm: (id: number) => setHiddenForms(set => toggle(set, id)),
    categories,
    hiddenCategories,
    onToggleCategory: (id: string) =>
      setHiddenCategories(set => toggle(set, id)),
  };

  const panel =
    last &&
    ('booking' in last ? (
      <MyBookingPanel
        slot={last}
        zone={zone}
        inline={isXl}
        onClose={() => setSelected(null)}
      />
    ) : (
      <SessionPanel
        session={last}
        zone={zone}
        inline={isXl}
        phone={isPhone}
        onClose={() => setSelected(null)}
        onChanged={refresh}
        onDialog={setDialogOpen}
      />
    ));

  return (
    // Below md the bottom nav is on screen, so the Agenda fills the space
    // between the header and the nav. Expanded, it covers both, inside the
    // safe area. Either way the hour grid is its only scroller (app.css stops
    // the page itself from scrolling). One element for both, so expanding
    // keeps the grid where it was.
    <div
      className={
        expanded
          ? 'agenda-expanded fixed inset-0 z-[150] flex flex-col bg-background pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]'
          : 'agenda-screen w-full px-4 py-3 sm:px-6 md:py-8 lg:px-8 max-md:fixed max-md:inset-x-0 max-md:top-[var(--app-header-offset)] max-md:bottom-[var(--mobile-nav-offset)] max-md:flex max-md:flex-col'
      }
    >
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
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
            {t('sessions', { count: visible.length + mine.length })}
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
              { value: 'month', label: t('view_month') },
            ]}
          />
        )}
        <button
          type="button"
          aria-label={expanded ? t('collapse') : t('expand')}
          aria-pressed={expanded}
          title={expanded ? t('collapse') : t('expand')}
          onClick={() => setExpanded(value => !value)}
          className="inline-flex size-11 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary lg:size-9"
        >
          {expanded ? (
            <IconArrowsMinimize size={18} />
          ) : (
            <IconArrowsMaximize size={18} />
          )}
        </button>
      </div>

      {error && (
        <div className="shrink-0">
          <Alert title={t('title')}>{t('error')}</Alert>
        </div>
      )}

      <div
        className={`flex gap-4 ${expanded ? 'min-h-0 flex-1' : 'max-md:min-h-0 max-md:flex-1'}`}
      >
        {isWide && (
          <aside
            className={`hidden w-56 shrink-0 self-start overflow-y-auto lg:block xl:w-64 ${expanded ? 'max-h-full' : 'sticky top-20 max-h-[calc(100dvh-6rem)]'}`}
          >
            <FiltersPanel {...filtersProps} large={false} />
          </aside>
        )}

        <Card
          className={`min-w-0 flex-1 overflow-hidden p-0 ${expanded ? 'flex flex-col' : 'max-md:flex max-md:flex-col'}`}
        >
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
                    className="flex min-h-14 flex-1 items-center justify-center p-1 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-primary"
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
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 size-1 rounded-full ${withSessions.has(day) ? (isAnchor ? 'bg-primary-foreground' : 'bg-primary') : ''}`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {!isLoading && visible.length + mine.length === 0 && (
            <p className="border-b border-border p-3 text-center text-sm text-muted-foreground">
              {t('empty')}
            </p>
          )}
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 z-30 animate-pulse bg-muted/60" />
            )}
            <AgendaCalendar
              view={view}
              anchor={anchor}
              sessions={visible}
              mine={mine}
              zone={zone}
              colors={colors}
              height={
                isPhone
                  ? 'calc(100dvh - 24rem)'
                  : expanded
                    ? 'calc(100dvh - 8rem)'
                    : 'calc(100dvh - 14rem)'
              }
              occupancyText={occupancyText}
              clientsOf={clientsOf}
              onSelect={id => setSelected(selected === id ? null : id)}
              onPickDay={day => {
                pick(day);
                setView('day');
              }}
              onMove={move}
            />
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
          styles={SHEET_STYLES}
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
          title={
            last && 'booking' in last
              ? last.booking.service
              : (last?.service_name ?? t('service_fallback'))
          }
          closeButtonProps={{ 'aria-label': t('panel_close') }}
          classNames={{ close: 'min-h-11 min-w-11' }}
          styles={SHEET_STYLES}
        >
          {panel}
        </Drawer>
      )}
    </div>
  );
}
