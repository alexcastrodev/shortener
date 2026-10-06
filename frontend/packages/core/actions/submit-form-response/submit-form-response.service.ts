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
    });
    return { manage_url: response.data.manage_url, email_delivery: response.data.email_delivery };
  } catch (error) {
    if (error instanceof AxiosError) {
      throw { ...error.response?.data, status: error.response?.status };
    }
    throw error;
  }
}
