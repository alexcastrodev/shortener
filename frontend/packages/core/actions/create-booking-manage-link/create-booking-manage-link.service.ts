import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { CreateBookingManageLinkResponse } from './create-booking-manage-link.types';

export async function createBookingManageLink(
  groupKey: string
): Promise<CreateBookingManageLinkResponse> {
  const response: AxiosResponse<CreateBookingManageLinkResponse> =
    await api.post(
      `/api/me/bookings/${encodeURIComponent(groupKey)}/manage_link`
    );

  return response.data;
}
