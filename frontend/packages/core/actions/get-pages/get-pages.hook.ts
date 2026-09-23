import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getPages } from './get-pages.service';
import type { Page } from '../../types/Page';

export const getPagesKey = ['get-pages'];

export function useGetPages(queryProps?: UseQueryOptions<Page[], ResponseError>) {
  return useQuery<Page[], ResponseError>({
    queryKey: getPagesKey,
    queryFn: getPages,
    ...queryProps,
  });
}
