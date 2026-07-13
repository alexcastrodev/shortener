import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getShortlinks } from './get-shortlinks.service';
import type { GetShortlinksParams, GetShortlinksResponse } from './get-shortlinks.types';

export function getShortlinksKey(params?: GetShortlinksParams) {
  return ['get-shortlinks', params ?? {}];
}

export function useGetShortlinks(
  params?: GetShortlinksParams,
  queryProps?: UseQueryOptions<GetShortlinksResponse, ResponseError>
) {
  return useQuery<GetShortlinksResponse, ResponseError>({
    queryKey: getShortlinksKey(params),
    queryFn: () => getShortlinks(params),
    ...queryProps,
  });
}
