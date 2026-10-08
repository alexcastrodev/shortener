import { useTranslation } from 'react-i18next';
import { formatDate } from '../../i18n/format';
import type { SubmitFormReceipt } from '@internal/core/actions/submit-form-response/submit-form-response.types';

type Props = {
  receipt?: SubmitFormReceipt | null;
  linkClass: string;
  textClass: string;
};

export function BookingReceipt({ receipt, linkClass, textClass }: Props) {
  const { t } = useTranslation('respond');
  if (!receipt?.manage_url) return null;
  const unverified = receipt.appointments?.some(item => item.status === 'unverified');

  return (
    <div className={`mt-6 text-sm ${textClass}`}>
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
