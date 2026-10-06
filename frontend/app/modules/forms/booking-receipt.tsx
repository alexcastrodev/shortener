import { useTranslation } from 'react-i18next';
import type { SubmitFormReceipt } from '@internal/core/actions/submit-form-response/submit-form-response.types';

type Props = { receipt?: SubmitFormReceipt | null; linkClass: string; textClass: string };

export function BookingReceipt({ receipt, linkClass, textClass }: Props) {
  const { t } = useTranslation('respond');
  if (!receipt?.manage_url) return null;

  return (
    <div className={`mt-6 text-sm ${textClass}`}>
      <p className="font-medium">{t('receipt_keep_link')}</p>
      <a href={receipt.manage_url} className={`mt-1 block break-all underline ${linkClass}`}>
        {receipt.manage_url}
      </a>
      <p className="mt-2">
        {receipt.email_delivery === 'queued' ? t('receipt_email_queued') : t('receipt_email_none')}
      </p>
    </div>
  );
}
