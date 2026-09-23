import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getPageStatistics } from './get-page-statistics.service';
import type {
  PageStatistics,
  PageStatisticsPeriod,
} from './get-page-statistics.types';

export function getPageStatisticsKey(
  id: number | string,
  days?: PageStatisticsPeriod
) {
  return days
    ? ['page-statistics', String(id), days]
    : ['page-statistics', String(id)];
}

export function useGetPageStatistics(
  id: number | string,
  days: PageStatisticsPeriod
) {
  return useQuery<PageStatistics, ResponseError>({
    queryKey: getPageStatisticsKey(id, days),
    queryFn: () => getPageStatistics(id, days),
    enabled: !!id,
    // Switching the period keeps the old numbers on screen until the new ones land.
    placeholderData: keepPreviousData,
  });
}
