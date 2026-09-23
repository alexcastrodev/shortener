import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getPage } from './get-page.service';
import type { Page } from '../../types/Page';

export function getPageKey(id: number | string) {
  return ['page', String(id)];
}

export function useGetPage(
  id: number | string,
  queryProps?: UseQueryOptions<Page, ResponseError>
) {
  return useQuery<Page, ResponseError>({
    queryKey: getPageKey(id),
    queryFn: () => getPage(id),
    enabled: !!id,
    ...queryProps,
  });
}
