import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getEventStatistics } from './get-event-statistics.service';
import type { EventStatistics } from './get-event-statistics.types';

export function useEventStatistics(
  id: number | string,
  queryProps?: UseQueryOptions<EventStatistics, ResponseError>
) {
  return useQuery<EventStatistics, ResponseError>({
    queryKey: ['event-statistics', id],
    queryFn: () => getEventStatistics(id),
    enabled: !!id,
    ...queryProps,
  });
}
