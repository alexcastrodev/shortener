import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getNotifications } from './get-notifications.service';
import type { GetNotificationsResponse } from './get-notifications.types';

export const getNotificationsKey = ['get-notifications'];

const REFRESH_MS = 60_000;

export function useGetNotifications(
  queryProps?: Partial<UseQueryOptions<GetNotificationsResponse, ResponseError>>
) {
  return useQuery<GetNotificationsResponse, ResponseError>({
    queryKey: getNotificationsKey,
    queryFn: getNotifications,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: false,
    ...queryProps,
  });
}
