import { IconCalendarEvent, IconCircleCheck, IconClock, IconMailExclamation } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate } from '../../i18n/format';
import type { BioTheme } from '../bio-page/themes';
import type { SubmitFormReceipt } from '@internal/core/actions/submit-form-response/submit-form-response.types';

type Props = {
  receipt?: SubmitFormReceipt | null;
  message?: string | null;
  theme: BioTheme;
  timeZone?: string;
};

export function SubmissionResult({ receipt, message, theme, timeZone }: Props) {
  const { t } = useTranslation('respond');
  const sessions = receipt?.appointments ?? [];
  const booked = Boolean(receipt?.manage_url) && sessions.length > 0;
  const unverified = sessions.some(item => item.status === 'unverified');
  const pending = sessions.some(item => item.status === 'pending');
  const state = !booked ? 'sent' : unverified ? 'unverified' : pending ? 'pending' : 'confirmed';
  const Icon = state === 'pending' ? IconClock : state === 'unverified' ? IconMailExclamation : IconCircleCheck;
  const title = {
    sent: t('thank_you'),
    confirmed: t('receipt_title_confirmed'),
    pending: t('receipt_title_pending'),
    unverified: t('receipt_title_unverified'),
  }[state];
  const lead = {
    sent: message || t('answers_sent'),
    confirmed: message || t('receipt_confirmed_lead'),
    pending: t('receipt_pending'),
    unverified: t('receipt_unverified'),
  }[state];

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-current/15"
        >
          <Icon size={26} />
        </span>
        <h1 className={`text-[32px] leading-tight font-semibold ${theme.title}`}>{title}</h1>
        <p className={`text-[15px] whitespace-pre-line ${theme.bio}`}>{lead}</p>
        {booked && (pending || unverified) && message && (
          <p className={`text-[15px] whitespace-pre-line ${theme.bio}`}>{message}</p>
        )}
      </div>

      {booked && receipt && (
        <>
          <section
            aria-label={t('receipt_details')}
            className="space-y-3 rounded-xl border border-current/20 p-5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-base font-semibold">{sessions[0].service}</p>
              {receipt.price && (
                <p className="text-xl font-semibold">
                  {formatCurrency(receipt.price.total, receipt.price.currency)}
                </p>
              )}
            </div>
            <ul className="space-y-1.5 text-[15px]">
              {sessions.map(item => (
                <li key={item.starts_at} className="flex items-center gap-2">
                  <IconCalendarEvent size={16} aria-hidden="true" className="shrink-0 opacity-70" />
                  {formatDate(item.starts_at, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone,
                  })}
                </li>
              ))}
            </ul>
            {receipt.skipped && receipt.skipped.length > 0 && (
              <p className="text-sm opacity-80">
                {t('receipt_skipped', {
                  dates: receipt.skipped
                    .map(day =>
                      formatDate(`${day}T12:00:00Z`, { day: 'numeric', month: 'short', timeZone: 'UTC' })
                    )
                    .join(', '),
                })}
              </p>
            )}
          </section>

          <section className="space-y-3">
            <a
              href={receipt.manage_url}
              className={`inline-flex min-h-12 items-center rounded-lg px-6 py-2 text-[15px] font-semibold ${theme.button}`}
            >
              {t('receipt_manage_button')}
            </a>
            <div className={`space-y-1 text-sm ${theme.bio}`}>
              <p>{t('receipt_keep_link')}</p>
              <a href={receipt.manage_url} className={`block text-xs break-all underline ${theme.footer}`}>
                {receipt.manage_url}
              </a>
              {!unverified && (
                <p className="pt-1">
                  {receipt.email_delivery === 'queued' ? t('receipt_email_queued') : t('receipt_email_none')}
                </p>
              )}
              {receipt.email_delivery === 'queued' && (
                <p className="pt-1">
                  <a href="/login" className={`underline ${theme.footer}`}>
                    {t('receipt_account')}
                  </a>
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
