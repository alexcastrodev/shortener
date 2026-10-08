import { AxiosError } from 'axios';
import { publicApi } from '../api';
import type { SubmitFormReceipt, SubmitFormResponseParams } from './submit-form-response.types';

export async function submitFormResponse({
  publicId,
  answers,
  idempotencyKey,
  turnstileToken,
  website,
  referer,
  clientTimeZone,
  clientLocale,
  confirmFieldId,
}: SubmitFormResponseParams): Promise<SubmitFormReceipt> {
  try {
    const response = await publicApi.post<SubmitFormReceipt>(`/api/public/forms/${encodeURIComponent(publicId)}/responses`, {
      answers,
      idempotency_key: idempotencyKey,
      turnstile_token: turnstileToken || undefined,
      website: website || undefined,
      referer: referer || undefined,
      client_time_zone: clientTimeZone || undefined,
      client_locale: clientLocale || undefined,
      confirm_field_id: confirmFieldId ?? null,
    });
    const { manage_url, email_delivery, skipped, appointments } = response.data;
    return { manage_url, email_delivery, skipped, appointments };
  } catch (error) {
    if (error instanceof AxiosError) {
      throw { ...error.response?.data, status: error.response?.status };
    }
    throw error;
  }
}
