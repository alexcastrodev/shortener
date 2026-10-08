import {
  keepPreviousData,
  useQuery,
  type UseQueryOptions,
} from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getMyBookings } from './get-my-bookings.service';
import type { GetMyBookingsResponse } from './get-my-bookings.types';

export const getMyBookingsKey = ['get-my-bookings'];

export function useGetMyBookings(
  from?: string,
  to?: string,
  queryProps?: Partial<UseQueryOptions<GetMyBookingsResponse, ResponseError>>
) {
  return useQuery<GetMyBookingsResponse, ResponseError>({
    queryKey: [...getMyBookingsKey, from, to],
    queryFn: () => getMyBookings(from, to),
    placeholderData: keepPreviousData,
    retry: false,
    ...queryProps,
  });
}
