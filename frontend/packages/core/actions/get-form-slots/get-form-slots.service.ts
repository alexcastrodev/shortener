import { publicApi } from '../api';
import type { GetFormSlotsResponse, LoadedSlots } from './get-form-slots.types';

export async function getFormSlots(
  publicId: string,
  service: string,
  from: string,
  to: string
): Promise<LoadedSlots> {
  const response = await publicApi.get<GetFormSlotsResponse>(
    `/api/public/forms/${encodeURIComponent(publicId)}/slots`,
    { params: { service, from, to } }
  );

  return { slots: response.data.slots, full: response.data.full ?? [] };
}
