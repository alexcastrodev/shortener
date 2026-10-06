import { publicApi } from '../api';
import type { FormSlot, GetFormSlotsResponse } from './get-form-slots.types';

export async function getFormSlots(
  publicId: string,
  service: string,
  from: string,
  to: string
): Promise<FormSlot[]> {
  const response = await publicApi.get<GetFormSlotsResponse>(
    `/api/public/forms/${encodeURIComponent(publicId)}/slots`,
    { params: { service, from, to } }
  );

  return response.data.slots;
}
