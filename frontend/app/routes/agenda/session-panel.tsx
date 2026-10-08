import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTicket, IconX } from '@tabler/icons-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Card } from '@internal/ui';
import { useAppointmentAction } from '@internal/core/actions/appointment-action/appointment-action.hook';
import { useCreateBookingManageLink } from '@internal/core/actions/create-booking-manage-link/create-booking-manage-link.hook';
import type { AppointmentActionName } from '@internal/core/actions/appointment-action/appointment-action.types';
import type {
  AgendaAppointment,
  AgendaSession,
} from '@internal/core/actions/get-agenda/get-agenda.types';
import { formatDateTime } from '../../i18n/format';
import { actionError } from '../../modules/agenda/agenda-actions.ts';
import type { MySlot } from '../../modules/agenda/schedule-events.ts';

type Dialog =
  | { kind: 'decline' | 'cancel'; appointment: AgendaAppointment }
  | { kind: 'reschedule'; appointment: AgendaAppointment }
  | null;

export function agendaErrorText(t: TFunction<'agenda'>, error: unknown) {
  switch (actionError(error)) {
    case 'expired':
      return t('err_expired');
    case 'already_decided':
      return t('err_already_decided');
    case 'nothing_to_cancel':
      return t('err_nothing_to_cancel');
    case 'too_soon':
      return t('err_too_soon');
    case 'no_email':
      return t('err_no_email');
    case 'nothing_to_remind':
      return t('err_nothing_to_remind');
    case 'same_time':
      return t('err_same_time');
    case 'unavailable':
      return t('err_unavailable');
    case 'not_reschedulable':
      return t('err_not_reschedulable');
    default:
      return t('err_unknown');
  }
}

export function statusText(t: TFunction<'agenda'>, status: string) {
  switch (status) {
    case 'pending':
      return t('status_pending');
    case 'unverified':
      return t('status_unverified');
    case 'cancelled':
      return t('status_cancelled');
    case 'declined':
      return t('status_declined');
    case 'expired':
      return t('status_expired');
    default:
      return t('status_confirmed');
  }
}

function Frame({
  inline,
  title,
  onClose,
  children,
}: {
  inline: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation('agenda');
  const Wrapper = inline ? Card : 'div';
  return (
    <Wrapper
      className={
        inline
          ? 'max-h-full w-[360px] shrink-0 self-start overflow-y-auto p-4'
          : undefined
      }
    >
      {inline && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 className="min-w-0 text-base font-semibold break-words">
            {title}
          </h2>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={t('panel_close')}
            onClick={onClose}
          >
            <IconX size={16} />
          </ActionIcon>
        </div>
      )}
      {children}
    </Wrapper>
  );
}

export function MyBookingPanel({
  slot,
  zone,
  inline,
  onClose,
}: {
  slot: MySlot;
  zone: string;
  inline: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('agenda');
  const { booking } = slot;
  const { mutate, isPending } = useCreateBookingManageLink({
    onSuccess: ({ manage_url }) => {
      window.open(manage_url, '_blank', 'noopener');
    },
    onError: () => {
      notifications.show({ message: t('err_unknown'), color: 'red' });
    },
  });

  return (
    <Frame inline={inline} title={booking.service} onClose={onClose}>
      <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <IconTicket size={14} aria-hidden="true" />
        {t('mine_label')}
      </p>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">{t('panel_when')}</dt>
          <dd>
            {formatDateTime(slot.starts_at, {
              dateStyle: 'full',
              timeStyle: 'short',
              timeZone: zone,
            })}
            {booking.time_zone !== zone && (
              <span className="block text-xs text-muted-foreground">
                {t('mine_zone_hint', {
                  time: formatDateTime(slot.starts_at, {
                    timeStyle: 'short',
                    timeZone: booking.time_zone,
                  }),
                  zone: booking.time_zone,
                })}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t('panel_form')}</dt>
          <dd>{booking.form_title}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            {t('panel_status')}
          </dt>
          <dd>
            <Badge
              variant="light"
              color={slot.status === 'confirmed' ? 'teal' : 'yellow'}
            >
              {statusText(t, slot.status)}
            </Badge>
          </dd>
        </div>
      </dl>

      {booking.sessions.length > 1 && (
        <>
          <h3 className="mt-4 mb-2 text-sm font-medium">
            {t('mine_sessions')} · {booking.sessions.length}
          </h3>
          <ul className="space-y-1 text-sm">
            {booking.sessions.map(session => (
              <li
                key={session.starts_at}
                aria-current={session.starts_at === slot.starts_at || undefined}
                className={`flex justify-between gap-2 ${session.starts_at === slot.starts_at ? 'font-medium' : ''}`}
              >
                <span>
                  {formatDateTime(session.starts_at, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: zone,
                  })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {statusText(t, session.status)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <Button
        mt="md"
        variant="light"
        color="brand"
        size={inline ? 'xs' : 'sm'}
        className={inline ? undefined : 'min-h-11'}
        loading={isPending}
        onClick={() => mutate(booking.group_key)}
      >
        {t('mine_manage')}
      </Button>
    </Frame>
  );
}

export function SessionPanel({
  session,
  zone,
  inline,
  phone,
  onClose,
  onChanged,
  onDialog,
}: {
  session: AgendaSession;
  zone: string;
  inline: boolean;
  phone: boolean;
  onClose: () => void;
  onChanged: () => void;
  onDialog: (open: boolean) => void;
}) {
  const { t } = useTranslation('agenda');
  const touch = inline
    ? ({ size: 'compact-xs' } as const)
    : ({ size: 'sm', className: 'min-h-11' } as const);
  const dialogButton = phone ? 'min-h-11' : undefined;
  const [dialog, setDialog] = useState<Dialog>(null);
  useEffect(() => {
    onDialog(dialog !== null);
    return () => onDialog(false);
  }, [dialog === null]);
  const [text, setText] = useState('');
  const [scope, setScope] = useState<'one' | 'remaining' | 'all'>('one');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const { mutate, isPending } = useAppointmentAction();

  const errorText = (error: unknown) => agendaErrorText(t, error);

  const doneText = (action: AppointmentActionName) => {
    switch (action) {
      case 'approve':
        return t('done_approve');
      case 'decline':
        return t('done_decline');
      case 'cancel':
        return t('done_cancel');
      case 'remind':
        return t('done_remind');
      default:
        return t('done_reschedule');
    }
  };

  const run = (
    appointment: AgendaAppointment,
    action: AppointmentActionName,
    data?: {
      message?: string;
      reason?: string;
      date?: string;
      time?: string;
      scope?: 'one' | 'remaining' | 'all';
    }
  ) => {
    mutate(
      { id: appointment.id, action, data },
      {
        onSuccess: () => {
          notifications.show({ message: doneText(action), color: 'teal' });
          setDialog(null);
          setText('');
          onChanged();
        },
        onError: error => {
          notifications.show({ message: errorText(error), color: 'red' });
          onChanged();
        },
      }
    );
  };

  const open = (next: Dialog) => {
    setText('');
    setDate('');
    setTime('');
    setDialog(next);
  };

  return (
    <Frame
      inline={inline}
      title={session.service_name ?? t('service_fallback')}
      onClose={onClose}
    >
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">{t('panel_when')}</dt>
          <dd>
            {formatDateTime(session.starts_at, {
              dateStyle: 'full',
              timeStyle: 'short',
              timeZone: zone,
            })}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t('panel_form')}</dt>
          <dd>{session.form_title}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            {t('panel_occupancy')}
          </dt>
          <dd>
            {session.capacity === null
              ? `${t('booked_unlimited', { count: session.booked })} · ${t('panel_unlimited')}`
              : t('booked_of', {
                  booked: session.booked,
                  capacity: session.capacity,
                })}
          </dd>
        </div>
      </dl>

      <h3 className="mt-4 mb-2 text-sm font-medium">
        {t('clients_title')} · {session.appointments.length}
      </h3>
      {session.appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('no_clients')}</p>
      ) : (
        <ul className="space-y-2">
          {session.appointments.map(appointment => (
            <li
              key={appointment.id}
              className="rounded-md border border-border p-2 text-sm"
            >
              <p className="font-medium break-words">
                {appointment.client_name ?? t('no_name')}
              </p>
              {appointment.client_email && (
                <p className="text-xs break-all text-muted-foreground">
                  {appointment.client_email}
                </p>
              )}
              <p
                className={`mt-1 text-xs ${appointment.status === 'pending' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}
              >
                {statusText(t, appointment.status)}
              </p>
              <Group gap={6} mt={6}>
                {appointment.status === 'pending' ? (
                  <>
                    <Button
                      {...touch}
                      color="brand"
                      loading={isPending}
                      onClick={() => run(appointment, 'approve')}
                    >
                      {t('approve')}
                    </Button>
                    <Button
                      {...touch}
                      variant="default"
                      disabled={isPending}
                      onClick={() => open({ kind: 'decline', appointment })}
                    >
                      {t('decline')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      {...touch}
                      variant="default"
                      disabled={isPending}
                      onClick={() => run(appointment, 'remind')}
                    >
                      {t('remind')}
                    </Button>
                    <Button
                      {...touch}
                      variant="default"
                      disabled={isPending}
                      onClick={() => open({ kind: 'reschedule', appointment })}
                    >
                      {t('reschedule')}
                    </Button>
                  </>
                )}
                <Button
                  {...touch}
                  variant="subtle"
                  color="red"
                  disabled={isPending}
                  onClick={() => {
                    setScope('one');
                    open({ kind: 'cancel', appointment });
                  }}
                >
                  {t('cancel')}
                </Button>
              </Group>
            </li>
          ))}
        </ul>
      )}

      <Modal
        opened={dialog?.kind === 'decline' || dialog?.kind === 'cancel'}
        onClose={() => setDialog(null)}
        centered
        fullScreen={phone}
        title={
          dialog?.kind === 'cancel' ? t('cancel_title') : t('decline_title')
        }
        classNames={{ close: 'min-h-11 min-w-11' }}
        styles={{ header: { background: 'transparent' } }}
      >
        <Stack gap="sm">
          <p className="text-sm">
            {dialog?.kind === 'cancel' ? t('cancel_body') : t('decline_body')}
          </p>
          {dialog?.kind === 'cancel' && dialog.appointment.series && (
            <SegmentedControl
              fullWidth
              orientation={phone ? 'vertical' : 'horizontal'}
              size={phone ? 'md' : 'xs'}
              aria-label={t('cancel_scope')}
              value={scope}
              onChange={value => setScope(value as 'one' | 'remaining' | 'all')}
              data={[
                { value: 'one', label: t('scope_one') },
                { value: 'remaining', label: t('scope_remaining') },
                { value: 'all', label: t('scope_all') },
              ]}
            />
          )}
          <Textarea
            label={
              dialog?.kind === 'cancel' ? t('reason_label') : t('message_label')
            }
            maxLength={500}
            autosize
            minRows={2}
            value={text}
            onChange={event => setText(event.currentTarget.value)}
          />
          <Group justify="flex-end" gap="xs">
            <Button
              variant="default"
              className={dialogButton}
              onClick={() => setDialog(null)}
            >
              {t('dialog_keep')}
            </Button>
            <Button
              className={dialogButton}
              color="red"
              loading={isPending}
              onClick={() =>
                dialog &&
                run(
                  dialog.appointment,
                  dialog.kind === 'cancel' ? 'cancel' : 'decline',
                  dialog.kind === 'cancel'
                    ? {
                        reason: text.trim() || undefined,
                        ...(dialog.appointment.series ? { scope } : {}),
                      }
                    : { message: text.trim() || undefined }
                )
              }
            >
              {dialog?.kind === 'cancel'
                ? t('confirm_cancel')
                : t('confirm_decline')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={dialog?.kind === 'reschedule'}
        onClose={() => setDialog(null)}
        centered
        fullScreen={phone}
        title={t('reschedule')}
        classNames={{ close: 'min-h-11 min-w-11' }}
        styles={{ header: { background: 'transparent' } }}
      >
        <Stack gap="sm">
          <Group grow>
            <TextInput
              type="date"
              label={t('new_date')}
              value={date}
              onChange={event => setDate(event.currentTarget.value)}
            />
            <TextInput
              type="time"
              label={t('new_time')}
              value={time}
              onChange={event => setTime(event.currentTarget.value)}
            />
          </Group>
          <Textarea
            label={t('message_label')}
            maxLength={500}
            autosize
            minRows={2}
            value={text}
            onChange={event => setText(event.currentTarget.value)}
          />
          <Group justify="flex-end" gap="xs">
            <Button
              variant="default"
              className={dialogButton}
              onClick={() => setDialog(null)}
            >
              {t('reschedule_cancel')}
            </Button>
            <Button
              className={dialogButton}
              color="brand"
              loading={isPending}
              disabled={!date || !time}
              onClick={() =>
                dialog &&
                run(dialog.appointment, 'reschedule', {
                  date,
                  time,
                  message: text.trim() || undefined,
                })
              }
            >
              {t('reschedule_confirm')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Frame>
  );
}
