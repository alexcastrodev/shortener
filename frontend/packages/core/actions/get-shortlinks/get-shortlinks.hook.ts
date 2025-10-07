import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getShortlinks } from './get-shortlinks.service';
import type { GetShortlinksResponse } from './get-shortlinks.types';

export const getShortlinksKey = ['get-shortlinks'];

export function useGetShortlinks(
  queryProps?: UseQueryOptions<GetShortlinksResponse, ResponseError>
) {
  return useQuery<GetShortlinksResponse, ResponseError>({
    queryKey: getShortlinksKey,
    queryFn: getShortlinks,
    ...queryProps,
  });
}
