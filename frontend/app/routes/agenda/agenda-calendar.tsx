import 'dayjs/locale/en';
import 'dayjs/locale/pt';
import { DayView, MonthView, WeekView } from '@mantine/schedule';
import type { ScheduleEventData } from '@mantine/schedule';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgendaSession } from '@internal/core/actions/get-agenda/get-agenda.types';
import {
  canReceive,
  clock,
  minutesOfDay,
  type View,
} from '../../modules/agenda/agenda-layout.ts';
import {
  keyOf,
  targetFor,
  toEvent,
  wallClock,
} from '../../modules/agenda/schedule-events.ts';

type Props = {
  view: View;
  anchor: string;
  sessions: AgendaSession[];
  zone: string;
  colors: Map<string, string>;
  height: string;
  occupancyText: (session: AgendaSession) => string;
  clientsOf: (session: AgendaSession) => unknown[];
  onSelect: (key: string) => void;
  onPickDay: (day: string) => void;
  onMove: (from: AgendaSession, target: AgendaSession) => void;
};

const sessionOf = (event: ScheduleEventData) =>
  event.payload?.session as AgendaSession;

export function AgendaCalendar({
  view,
  anchor,
  sessions,
  zone,
  colors,
  height,
  occupancyText,
  clientsOf,
  onSelect,
  onPickDay,
  onMove,
}: Props) {
  const { t, i18n } = useTranslation('agenda');
  const events = useMemo(
    () => sessions.map(session => toEvent(session, zone, colors)),
    [sessions, zone, colors]
  );
  const locale = i18n.language.startsWith('pt') ? 'pt' : 'en';
  const nowLocal = () => {
    const now = new Date();
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(
      now
    );
    return wallClock(day, minutesOfDay(now, zone));
  };
  const startScrollTime = `${clock(Math.max(0, minutesOfDay(new Date(), zone) - 120)).slice(0, 2)}:00:00`;

  const canDragEvent = (event: ScheduleEventData) => {
    const session = sessionOf(event);
    return (
      new Date(session.starts_at) > new Date() && clientsOf(session).length > 0
    );
  };
  const canDropEvent = ({
    event,
    start,
  }: {
    event: ScheduleEventData;
    start: string;
  }) => {
    const from = sessionOf(event);
    const target = targetFor(sessions, from, start, zone);
    return !!target && canReceive(from, clientsOf(from).length, target);
  };
  const onEventDrop = ({
    event,
    newStart,
  }: {
    event: ScheduleEventData;
    newStart: string;
  }) => {
    const from = sessionOf(event);
    const target = targetFor(sessions, from, newStart, zone);
    if (target) onMove(from, target);
  };
  const renderEventBody = (event: ScheduleEventData) => {
    const session = sessionOf(event);
    return (
      <div className="min-w-0 text-left leading-tight">
        <p className="truncate text-sm font-semibold">{event.title}</p>
        <p className="truncate text-[11px] opacity-80">
          {clock(minutesOfDay(session.starts_at, zone))} ·{' '}
          {occupancyText(session)}
          {session.pending > 0
            ? ` · ${t('pending', { count: session.pending })}`
            : ''}
        </p>
      </div>
    );
  };
  const renderEvent = (
    event: ScheduleEventData,
    props: React.ComponentPropsWithoutRef<'button'> & {
      children: React.ReactNode;
    }
  ) => {
    const color = event.color ?? 'var(--color-primary)';
    const pending = sessionOf(event).pending > 0;
    return (
      <button
        {...props}
        style={{
          ...props.style,
          ['--event-bg' as string]: `color-mix(in srgb, ${color} 26%, var(--color-background))`,
          ['--event-hover' as string]: `color-mix(in srgb, ${color} 38%, var(--color-background))`,
          ['--event-color' as string]: 'var(--color-foreground)',
          border: `1px ${pending ? 'dashed' : 'solid'} ${color}`,
        }}
      />
    );
  };
  const common = {
    date: anchor,
    events,
    locale,
    withHeader: false,
    labels: {
      week: t('view_week'),
      moreLabel: (count: number) => t('more', { count }),
    },
    firstDayOfWeek: 1 as const,
    withEventsDragAndDrop: true,
    canDragEvent,
    canDropEvent,
    onEventDrop,
    renderEventBody,
    renderEvent,
    onEventClick: (event: ScheduleEventData) =>
      onSelect(keyOf(sessionOf(event))),
  };

  if (view === 'month') {
    return (
      <MonthView
        {...common}
        consistentWeeks
        maxEventsPerDay={3}
        highlightToday
        onDayClick={day => onPickDay(String(day).slice(0, 10))}
      />
    );
  }

  const grid = {
    ...common,
    eventOverlapMode: 'cascade' as const,
    eventOverlapRaiseDelay: 250,
    eventDragInterval: 15,
    withCurrentTimeIndicator: true,
    getCurrentTime: nowLocal,
    startScrollTime,
    highlightToday: true,
    slotHeight: 52,
    scrollAreaProps: { mah: height },
  };

  return view === 'day' ? (
    <DayView {...grid} />
  ) : (
    <WeekView {...grid} withAllDaySlots={false} />
  );
}
