import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { GetMyBookingsResponse } from './get-my-bookings.types';

export async function getMyBookings(
  from?: string,
  to?: string
): Promise<GetMyBookingsResponse> {
  const response: AxiosResponse<GetMyBookingsResponse> = await api.get(
    '/api/me/bookings',
    { params: { from, to } }
  );

  return response.data;
}
