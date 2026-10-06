import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { data, isRouteErrorResponse } from 'react-router';
import {
  claimWaitlist,
  getWaitlistEntry,
  leaveWaitlist,
  type WaitlistState,
} from '@internal/core/actions/waitlist/waitlist.service';
import { formatDateTime } from '../../i18n/format';
import type { Route } from './+types/$token';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const loaded = await getWaitlistEntry(params.token);
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
    { title: 'Waiting list - Kurz' },
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

export default function WaitlistPage({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation('waitlist');
  const { token } = loaderData;
  const [state, setState] = useState<WaitlistState>(loaderData.loaded);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { waitlist, result } = state;
  const zone = waitlist.time_zone;

  const run = async (action: typeof claimWaitlist) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      setState(await action(token));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const message =
    result === 'claimed' || waitlist.status === 'claimed'
      ? t('claimed')
      : result === 'unavailable'
        ? t('unavailable')
        : result === 'expired' || waitlist.status === 'expired'
          ? t('expired')
          : result === 'left' || waitlist.status === 'left'
            ? t('left')
            : null;

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-background px-4 py-12 text-foreground">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {waitlist.form_title}
      </p>

      {message && (
        <p
          role="status"
          className="mt-6 rounded-md border border-border bg-muted px-3 py-2 text-sm"
        >
          {message}
        </p>
      )}

      <dl className="mt-6 space-y-4 text-sm">
        <div>
          <dt className="text-muted-foreground">{t('service')}</dt>
          <dd className="font-medium">{waitlist.service}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('when')}</dt>
          <dd>
            {formatDateTime(waitlist.starts_at, {
              dateStyle: 'full',
              timeStyle: 'short',
              timeZone: zone,
            })}
          </dd>
        </div>
      </dl>

      {waitlist.status === 'waiting' && (
        <p className="mt-6 text-sm text-muted-foreground">{t('waiting')}</p>
      )}

      {waitlist.status === 'offered' && waitlist.offered_until && (
        <p className="mt-6 text-sm">
          {t('offered', {
            until: formatDateTime(waitlist.offered_until, {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: zone,
            }),
          })}
        </p>
      )}

      {failed && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {t('failed')}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {waitlist.status === 'offered' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(claimWaitlist)}
            className="rounded-md bg-[#5ec8c4] px-4 py-2 text-sm font-medium text-[#0b1f1f] disabled:opacity-60"
          >
            {busy ? t('working') : t('confirm')}
          </button>
        )}
        {(waitlist.status === 'waiting' || waitlist.status === 'offered') && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(leaveWaitlist)}
            className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-60"
          >
            {t('leave')}
          </button>
        )}
      </div>
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useTranslation('waitlist');
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-background px-4 py-12 text-foreground">
      <h1 className="text-2xl font-semibold">
        {notFound ? t('not_found_title') : t('error_title')}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {notFound ? t('not_found_body') : t('error_body')}
      </p>
    </main>
  );
}
