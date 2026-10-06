import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { data, isRouteErrorResponse } from 'react-router';
import { getAppointment } from '@internal/core/actions/get-appointment/get-appointment.service';
import { cancelAppointment } from '@internal/core/actions/cancel-appointment/cancel-appointment.service';
import type { ManagedAppointment } from '@internal/core/actions/get-appointment/get-appointment.types';
import { formatDateTime } from '../../i18n/format';
import type { Route } from './+types/$token';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const appointment = await getAppointment(params.token);
  if (!appointment) throw data('Not found', { status: 404 });

  return { appointment, token: params.token };
}

export function headers() {
  return {
    'Content-Security-Policy': "frame-ancestors 'none'",
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  };
}

export function meta() {
  return [
    { title: 'Booking - Kurz' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

export function HydrateFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
    </div>
  );
}

export default function ManageBooking({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation('manage');
  const { token } = loaderData;
  const [appointment, setAppointment] = useState<ManagedAppointment>(loaderData.appointment);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [justCancelled, setJustCancelled] = useState(false);

  const cancelled = appointment.status === 'cancelled';

  const onCancel = async () => {
    setBusy(true);
    setFailed(false);
    try {
      setAppointment(await cancelAppointment(token, reason));
      setJustCancelled(true);
      setConfirming(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-background px-4 py-12 text-foreground">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{appointment.form_title}</p>

      {justCancelled && (
        <p role="status" className="mt-6 rounded-md border border-border bg-muted px-3 py-2 text-sm">
          {t('cancelled_notice')}
        </p>
      )}

      <dl className="mt-6 space-y-4 text-sm">
        <div>
          <dt className="text-muted-foreground">{t('service')}</dt>
          <dd className="font-medium">{appointment.service}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('status')}</dt>
          <dd className="font-medium">
            {cancelled ? t('status_cancelled') : t('status_confirmed')}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('sessions')}</dt>
          <dd>
            <ul className="mt-1 space-y-1">
              {appointment.sessions.map(session => (
                <li key={session.starts_at} className="flex justify-between gap-3">
                  <span>
                    {formatDateTime(session.starts_at, {
                      dateStyle: 'full',
                      timeStyle: 'short',
                      timeZone: appointment.time_zone,
                    })}
                  </span>
                  {session.status === 'cancelled' && (
                    <span className="text-muted-foreground">{t('session_cancelled')}</span>
                  )}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>

      {!cancelled && !appointment.cancellable && (
        <p className="mt-6 text-sm text-muted-foreground">{t('past_notice')}</p>
      )}

      {!cancelled && appointment.cancellable && !confirming && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-8 rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
        >
          {t('cancel_button')}
        </button>
      )}

      {confirming && (
        <section aria-labelledby="cancel-title" className="mt-8 rounded-md border border-border p-4">
          <h2 id="cancel-title" className="font-medium">{t('cancel_confirm_title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('cancel_confirm_body')}</p>
          <label className="mt-4 block text-sm">
            {t('reason_label')}
            <textarea
              value={reason}
              onChange={event => setReason(event.target.value)}
              maxLength={500}
              rows={3}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          {failed && (
            <p role="alert" className="mt-3 text-sm text-destructive">{t('cancel_failed')}</p>
          )}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? t('cancelling') : t('cancel_confirm')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="rounded-md border border-border px-4 py-2 text-sm"
            >
              {t('cancel_keep')}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useTranslation('manage');
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <div className="min-h-dvh bg-background px-4 pt-24 text-center text-foreground">
      <h1 className="text-xl font-semibold">
        {notFound ? t('not_found_title') : t('error_title')}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {notFound ? t('not_found_body') : t('error_body')}
      </p>
    </div>
  );
}
