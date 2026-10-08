import 'dayjs/locale/en';
import 'dayjs/locale/pt';
import { DayView, MonthView, WeekView } from '@mantine/schedule';
import type { ScheduleEventData } from '@mantine/schedule';
import { notifications } from '@mantine/notifications';
import { IconTicket } from '@tabler/icons-react';
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
  slotEvent,
  targetFor,
  toEvent,
  wallClock,
  type MySlot,
} from '../../modules/agenda/schedule-events.ts';
import { statusText } from './session-panel';

type Props = {
  view: View;
  anchor: string;
  sessions: AgendaSession[];
  mine: MySlot[];
  zone: string;
  colors: Map<string, string>;
  height: string;
  occupancyText: (session: AgendaSession) => string;
  clientsOf: (session: AgendaSession) => unknown[];
  onSelect: (key: string) => void;
  onPickDay: (day: string) => void;
  onMove: (from: AgendaSession, to: { date: string; time: string }) => void;
};

const sessionOf = (event: ScheduleEventData) =>
  event.payload?.session as AgendaSession;

const slotOf = (event: ScheduleEventData) =>
  event.payload?.slot as MySlot | undefined;

export function AgendaCalendar({
  view,
  anchor,
  sessions,
  mine,
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
    () => [
      ...sessions.map(session => toEvent(session, zone, colors)),
      ...mine.map(slot => slotEvent(slot, zone)),
    ],
    [sessions, mine, zone, colors]
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
    if (slotOf(event)) return false;
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
    if (start.replace('T', ' ').slice(0, 16) <= nowLocal().slice(0, 16))
      return false;
    const target = targetFor(sessions, from, start, zone);
    return !target || canReceive(from, clientsOf(from).length, target);
  };
  const onEventDrop = ({
    event,
    newStart,
  }: {
    event: ScheduleEventData;
    newStart: string;
  }) => {
    const normal = newStart.replace('T', ' ');
    onMove(sessionOf(event), {
      date: normal.slice(0, 10),
      time: normal.slice(11, 16),
    });
  };
  const renderEventBody = (event: ScheduleEventData) => {
    const slot = slotOf(event);
    if (slot)
      return (
        <div className="min-w-0 text-left leading-tight">
          <p className="flex items-center gap-1 text-sm font-semibold">
            <IconTicket size={12} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{event.title}</span>
          </p>
          <p className="truncate text-[11px] opacity-80">
            {clock(minutesOfDay(slot.starts_at, zone))} · {t('mine_label')}
            {slot.status === 'confirmed'
              ? ''
              : ` · ${statusText(t, slot.status)}`}
          </p>
        </div>
      );
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
    const slot = slotOf(event);
    const line = slot
      ? `color-mix(in srgb, ${color} 45%, var(--color-background))`
      : color;
    const pending = slot
      ? slot.status !== 'confirmed'
      : sessionOf(event).pending > 0;
    return (
      <button
        {...props}
        style={{
          ...props.style,
          ['--event-bg' as string]: `color-mix(in srgb, ${color} ${slot ? 6 : 26}%, var(--color-background))`,
          ['--event-hover' as string]: `color-mix(in srgb, ${color} ${slot ? 14 : 38}%, var(--color-background))`,
          ['--event-color' as string]: `color-mix(in srgb, ${color} 55%, var(--color-foreground))`,
          border: `1px ${pending ? 'dashed' : 'solid'} ${line}`,
          ...(slot ? { borderLeft: `3px solid ${line}` } : {}),
          borderRadius: 'var(--event-radius)',
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
    onEventPlacementRejected: () =>
      notifications.show({ message: t('drop_rejected'), color: 'orange' }),
    renderEventBody,
    renderEvent,
    onEventClick: (event: ScheduleEventData) => onSelect(String(event.id)),
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
