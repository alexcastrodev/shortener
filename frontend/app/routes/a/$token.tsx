import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { data, isRouteErrorResponse } from 'react-router';
import { getAppointmentDecision } from '@internal/core/actions/get-appointment-decision/get-appointment-decision.service';
import { decideAppointment } from '@internal/core/actions/decide-appointment/decide-appointment.service';
import type { GetAppointmentDecisionResponse } from '@internal/core/actions/get-appointment-decision/get-appointment-decision.types';
import { formatDateTime } from '../../i18n/format';
import type { Route } from './+types/$token';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const loaded = await getAppointmentDecision(params.token);
  if (!loaded) throw data('Not found', { status: 404 });

  return { loaded, token: params.token };
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
    { title: 'Booking request - Kurz' },
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

export default function DecideBooking({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation('decide');
  const { token } = loaderData;
  const [state, setState] = useState<GetAppointmentDecisionResponse>(loaderData.loaded);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { appointment, result } = state;
  const pending = appointment.status === 'pending';

  const decide = async (decision: 'approve' | 'decline') => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      setState(await decideAppointment(token, decision, message));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const zone = appointment.time_zone;
  const resultText =
    result === 'approve'
      ? t('result_approve')
      : result === 'decline'
        ? t('result_decline')
        : result === 'already_decided'
          ? t('result_already_decided')
          : result === 'expired'
            ? t('result_expired')
            : null;

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-background px-4 py-12 text-foreground">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{appointment.form_title}</p>

      {resultText && (
        <p role="status" className="mt-6 rounded-md border border-border bg-muted px-3 py-2 text-sm">
          {resultText}
        </p>
      )}

      <dl className="mt-6 space-y-4 text-sm">
        <div>
          <dt className="text-muted-foreground">{t('client')}</dt>
          <dd className="font-medium">
            {appointment.client_name}
            {appointment.client_email && (
              <span className="block font-normal text-muted-foreground">{appointment.client_email}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('service')}</dt>
          <dd className="font-medium">{appointment.service}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('sessions')}</dt>
          <dd>
            <ul className="mt-1 space-y-1">
              {appointment.sessions.map(session => (
                <li key={session.starts_at}>
                  {formatDateTime(session.starts_at, { dateStyle: 'full', timeStyle: 'short', timeZone: zone })}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>

      {pending && appointment.expires_at && (
        <p className="mt-6 text-sm text-muted-foreground">
          {t('deadline', {
            when: formatDateTime(appointment.expires_at, { dateStyle: 'medium', timeStyle: 'short', timeZone: zone }),
          })}
        </p>
      )}

      {pending && result !== 'expired' && (
        <section className="mt-6">
          <label className="block text-sm">
            {t('message_label')}
            <textarea
              value={message}
              onChange={event => setMessage(event.target.value)}
              maxLength={500}
              rows={3}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          {failed && (
            <p role="alert" className="mt-3 text-sm text-destructive">{t('failed')}</p>
          )}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => decide('approve')}
              className="rounded-md bg-[#5ec8c4] px-4 py-2 text-sm font-medium text-[#0b1f1f] disabled:opacity-60"
            >
              {busy ? t('working') : t('approve')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide('decline')}
              className="rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive disabled:opacity-60"
            >
              {t('decline')}
            </button>
          </div>
        </section>
      )}

      {!pending && !resultText && (
        <p className="mt-6 text-sm font-medium">
          {appointment.status === 'confirmed'
            ? t('state_confirmed')
            : appointment.status === 'declined'
              ? t('state_declined')
              : appointment.status === 'cancelled'
                ? t('state_cancelled')
                : t('state_expired')}
        </p>
      )}
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useTranslation('decide');
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
