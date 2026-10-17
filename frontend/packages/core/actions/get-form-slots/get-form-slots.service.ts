import { publicApi } from '../api';
import type { GetFormSlotsResponse, LoadedSlots } from './get-form-slots.types';

const SLOTS_TIMEOUT_MS = 10_000;

export async function getFormSlots(
  publicId: string,
  service: string,
  from: string,
  to: string,
  monthly = false
): Promise<LoadedSlots> {
  const response = await publicApi.get<GetFormSlotsResponse>(
    `/api/public/forms/${encodeURIComponent(publicId)}/slots`,
    {
      params: { service, from, to, ...(monthly ? { monthly: 1 } : {}) },
      timeout: SLOTS_TIMEOUT_MS,
    }
  );

  return { slots: response.data.slots, full: response.data.full ?? [] };
}
