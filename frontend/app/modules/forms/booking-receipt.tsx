import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate } from '../../i18n/format';
import type { SubmitFormReceipt } from '@internal/core/actions/submit-form-response/submit-form-response.types';

type Props = {
  receipt?: SubmitFormReceipt | null;
  linkClass: string;
  textClass: string;
  timeZone?: string;
};

export function BookingReceipt({
  receipt,
  linkClass,
  textClass,
  timeZone,
}: Props) {
  const { t } = useTranslation('respond');
  if (!receipt?.manage_url) return null;
  const unverified = receipt.appointments?.some(item => item.status === 'unverified');
  const pending = receipt.appointments?.some(item => item.status === 'pending');
  const sessions = receipt.appointments ?? [];

  return (
    <div className={`mt-6 text-sm ${textClass}`}>
      {sessions.length > 0 && (
        <div className="mb-4 space-y-3">
          <span className="inline-block rounded-full border border-current/30 px-3 py-0.5 text-xs font-medium">
            {unverified
              ? t('receipt_status_unverified')
              : pending
                ? t('receipt_status_pending')
                : t('receipt_status_confirmed')}
          </span>
          <div className="space-y-2 rounded-xl border border-current/20 p-4">
            <div className="flex justify-between gap-3 text-base font-semibold">
              <span>{sessions[0].service}</span>
              {receipt.price && (
                <span>
                  {formatCurrency(receipt.price.total, receipt.price.currency)}
                </span>
              )}
            </div>
            <ul className="space-y-0.5">
              {sessions.map(item => (
                <li key={item.starts_at}>
                  {formatDate(item.starts_at, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone,
                  })}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {receipt.appointments?.some(item => item.status === 'pending') && (
        <p className="mb-2 font-medium">{t('receipt_pending')}</p>
      )}
      {unverified && (
        <p role="status" className="mb-2 font-medium">
          {t('receipt_unverified')}
        </p>
      )}
      {receipt.skipped && receipt.skipped.length > 0 && (
        <p className="mb-2">
          {t('receipt_skipped', {
            dates: receipt.skipped
              .map(day =>
                formatDate(`${day}T12:00:00Z`, {
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
                })
              )
              .join(', '),
          })}
        </p>
      )}
      <p className="font-medium">{t('receipt_keep_link')}</p>
      <a
        href={receipt.manage_url}
        className={`mt-1 block break-all underline ${linkClass}`}
      >
        {receipt.manage_url}
      </a>
      {!unverified && (
        <p className="mt-2">
          {receipt.email_delivery === 'queued'
            ? t('receipt_email_queued')
            : t('receipt_email_none')}
        </p>
      )}
      {receipt.email_delivery === 'queued' && (
        <p className="mt-2">
          <a href="/login" className={`underline ${linkClass}`}>
            {t('receipt_account')}
          </a>
        </p>
      )}
    </div>
  );
}
