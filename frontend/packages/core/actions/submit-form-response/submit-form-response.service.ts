import { AxiosError } from 'axios';
import { publicApi } from '../api';
import type { SubmitFormResponseParams } from './submit-form-response.types';

export async function submitFormResponse({
  publicId,
  answers,
  idempotencyKey,
  turnstileToken,
  website,
  referer,
}: SubmitFormResponseParams): Promise<void> {
  try {
    await publicApi.post(`/api/public/forms/${encodeURIComponent(publicId)}/responses`, {
      answers,
      idempotency_key: idempotencyKey,
      turnstile_token: turnstileToken || undefined,
      website: website || undefined,
      referer: referer || undefined,
    });
  } catch (error) {
    if (error instanceof AxiosError) {
      throw { ...error.response?.data, status: error.response?.status };
    }
    throw error;
  }
}
