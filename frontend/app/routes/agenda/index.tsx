import {
  ActionIcon,
  Button,
  Group,
  SegmentedControl,
  Select,
} from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Card, PageContainer } from '@internal/ui';
import {
  getAgendaKey,
  useGetAgenda,
} from '@internal/core/actions/get-agenda/get-agenda.hook';
import { useAppointmentAction } from '@internal/core/actions/appointment-action/appointment-action.hook';
import type { AgendaSession } from '@internal/core/actions/get-agenda/get-agenda.types';
import { useUserState } from '@internal/core/states/use-user-state';
import { formatDate, formatDateTime } from '../../i18n/format';
import {
  HOUR_PX,
  clock,
  dayBlocks,
  minutesOfDay,
  pendingTotal,
  rangeFor,
  sessionsByDay,
  step,
  todayIn,
  type View,
} from '../../modules/agenda/agenda-layout.ts';
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

export default function AgendaPage() {
  const { t } = useTranslation('agenda');
  const user = useUserState(state => state.user);
  const fallbackZone = user?.time_zone ?? 'UTC';
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(() => todayIn(fallbackZone));
  const [formId, setFormId] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [waitingOnly, setWaitingOnly] = useState(false);
  const queryClient = useQueryClient();
  const { mutateAsync: act, isPending: approving } = useAppointmentAction();
  const [now, setNow] = useState(() => new Date());
  const scroller = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  const { from, to, days } = rangeFor(view, anchor);
  const { data, error, isLoading } = useGetAgenda(from, to);
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

  const forms = useMemo(() => {
    const seen = new Map<number, string>();
    for (const session of data?.sessions ?? [])
      seen.set(session.form_id, session.form_title);
    return [...seen].map(([value, label]) => ({ value: String(value), label }));
  }, [data]);

  const inForm = useMemo(
    () =>
      (data?.sessions ?? []).filter(
        session => formId === null || session.form_id === formId
      ),
    [data, formId]
  );
  const visible = useMemo(
    () => (waitingOnly ? onlyPending(inForm) : inForm),
    [inForm, waitingOnly]
  );
  const byDay = useMemo(() => sessionsByDay(visible, null), [visible]);
  const chosen = visible.find(session => keyOf(session) === selected) ?? null;
  const pending = pendingTotal(inForm);
  const targets = useMemo(() => pendingTargets(inForm), [inForm]);
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

  const label =
    view === 'day'
      ? formatDate(`${anchor}T12:00:00Z`, {
          dateStyle: 'full',
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

  return (
    <PageContainer>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-2 text-2xl font-semibold tracking-tight">
          {t('title')}
        </h1>
        <Button
          variant="default"
          size="xs"
          onClick={() => setAnchor(todayIn(zone))}
        >
          {t('today')}
        </Button>
        <Group gap={2}>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={t('previous')}
            onClick={() => setAnchor(step(view, anchor, -1))}
          >
            <IconChevronLeft size={18} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={t('next')}
            onClick={() => setAnchor(step(view, anchor, 1))}
          >
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {t('sessions', { count: visible.length })}
        </p>
        {pending > 0 && (
          <>
            <button
              type="button"
              aria-pressed={waitingOnly}
              onClick={() => setWaitingOnly(value => !value)}
              className={`rounded-full border px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400 ${waitingOnly ? 'border-amber-500 bg-amber-500/20' : 'border-amber-500/50 bg-amber-500/10'}`}
            >
              {t('awaiting', { count: pending })} ·{' '}
              {waitingOnly ? t('filter_all') : t('filter_waiting')}
            </button>
            <Button
              size="compact-xs"
              color="brand"
              loading={approving}
              onClick={approveAll}
            >
              {t('approve_all', { count: targets.length })}
            </Button>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          {forms.length > 1 && (
            <Select
              size="xs"
              aria-label={t('filter_form')}
              placeholder={t('all_forms')}
              clearable
              data={forms}
              value={formId === null ? null : String(formId)}
              onChange={value => setFormId(value ? Number(value) : null)}
            />
          )}
          <SegmentedControl
            size="xs"
            aria-label={t('view_label')}
            value={view}
            onChange={value => setView(value as View)}
            data={[
              { value: 'week', label: t('view_week') },
              { value: 'day', label: t('view_day') },
            ]}
          />
        </div>
      </div>

      {error && <Alert title={t('title')}>{t('error')}</Alert>}

      <div className="flex flex-col gap-4 lg:flex-row">
        <Card className="min-w-0 flex-1 overflow-hidden p-0">
          <div className="flex border-b border-border pl-14">
            {days.map(day => (
              <div
                key={day}
                className="flex-1 border-l border-border py-2 text-center"
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
          <div
            ref={scroller}
            className="relative max-h-[640px] overflow-y-auto"
          >
            {isLoading && <div className="h-40 animate-pulse bg-muted" />}
            <div className="relative flex" style={{ height: 24 * HOUR_PX }}>
              <div className="w-14 shrink-0">
                {HOURS.map(hour => (
                  <div
                    key={hour}
                    className="pr-2 text-right font-mono text-[10.5px] text-muted-foreground"
                    style={{ height: HOUR_PX }}
                  >
                    {hour === 0 ? '' : clock(hour * 60)}
                  </div>
                ))}
              </div>
              {days.map(day => (
                <div
                  key={day}
                  className={`relative flex-1 border-l border-border ${day === today ? 'bg-primary/5' : ''}`}
                >
                  {HOURS.map(hour => (
                    <div
                      key={hour}
                      className="border-b border-border/60"
                      style={{ height: HOUR_PX }}
                    />
                  ))}
                  {dayBlocks(byDay.get(day) ?? [], zone).map(block => {
                    const session = block.session;
                    const isSelected = keyOf(session) === selected;
                    return (
                      <button
                        key={keyOf(session)}
                        type="button"
                        onClick={() =>
                          setSelected(isSelected ? null : keyOf(session))
                        }
                        className={`absolute overflow-hidden rounded-md border px-1.5 py-1 text-left text-xs ${session.pending > 0 ? 'border-dashed' : ''} ${
                          isSelected
                            ? 'border-primary bg-primary/30'
                            : 'border-primary/40 bg-primary/15'
                        }`}
                        style={{
                          top: block.top,
                          height: block.height,
                          left: `calc(${(block.lane / block.lanes) * 100}% + 2px)`,
                          width: `calc(${100 / block.lanes}% - 4px)`,
                        }}
                      >
                        <span className="block truncate font-semibold">
                          {session.service_name ?? t('service_fallback')}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {clock(minutesOfDay(session.starts_at, zone))} ·{' '}
                          {occupancyText(session)}
                          {session.pending > 0
                            ? ` · ${t('pending', { count: session.pending })}`
                            : ''}
                        </span>
                      </button>
                    );
                  })}
                  {day === today && (
                    <div
                      aria-label={t('now')}
                      className="pointer-events-none absolute right-0 left-0 h-0.5 bg-red-500"
                      style={{ top: (minutesOfDay(now, zone) / 60) * HOUR_PX }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          {!isLoading && visible.length === 0 && (
            <p className="border-t border-border p-4 text-center text-sm text-muted-foreground">
              {t('empty')}
            </p>
          )}
        </Card>

        {chosen && (
          <SessionPanel
            session={chosen}
            zone={zone}
            onClose={() => setSelected(null)}
            onChanged={refresh}
          />
        )}
      </div>
    </PageContainer>
  );
}
