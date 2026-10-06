import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { data, isRouteErrorResponse } from 'react-router';
import {
  confirmVerification,
  getVerification,
  type VerificationResponse,
} from '@internal/core/actions/appointment-verification/appointment-verification.service';
import { formatDateTime } from '../../i18n/format';
import type { Route } from './+types/$token';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const loaded = await getVerification(params.token);
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
    { title: 'Confirm your booking - Kurz' },
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

export default function VerifyBooking({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation('verify');
  const { token } = loaderData;
  const [state, setState] = useState<VerificationResponse>(loaderData.loaded);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { appointment, result } = state;
  const waiting = appointment.status === 'unverified' && result !== 'expired';

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      setState(await confirmVerification(token));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const message =
    result === 'verified' || appointment.status === 'confirmed'
      ? t('done')
      : result === 'expired' || appointment.status === 'expired'
        ? t('expired')
        : appointment.status === 'cancelled'
          ? t('cancelled')
          : null;

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-background px-4 py-12 text-foreground">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{appointment.form_title}</p>

      {message && (
        <p role="status" className="mt-6 rounded-md border border-border bg-muted px-3 py-2 text-sm">
          {message}
        </p>
      )}

      <dl className="mt-6 space-y-4 text-sm">
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
                  {formatDateTime(session.starts_at, {
                    dateStyle: 'full',
                    timeStyle: 'short',
                    timeZone: appointment.time_zone,
                  })}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>

      {waiting && (
        <section className="mt-6">
          {appointment.expires_at && (
            <p className="mb-3 text-sm text-muted-foreground">
              {t('until', {
                when: formatDateTime(appointment.expires_at, {
                  timeStyle: 'short',
                  timeZone: appointment.time_zone,
                }),
              })}
            </p>
          )}
          {failed && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {t('failed')}
            </p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={confirm}
            className="rounded-md bg-[#5ec8c4] px-4 py-2 text-sm font-medium text-[#0b1f1f] disabled:opacity-60"
          >
            {busy ? t('working') : t('confirm')}
          </button>
        </section>
      )}
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useTranslation('verify');
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-background px-4 py-12 text-foreground">
      <h1 className="text-2xl font-semibold">{notFound ? t('not_found_title') : t('error_title')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {notFound ? t('not_found_body') : t('error_body')}
      </p>
    </main>
  );
}
