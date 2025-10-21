import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getAdminShortlinks } from './admin-shortlink.service';
import type { AdminGetShortlinksResponse } from './admin-shortlink.types';

export const adminGetShortlinksKey = ['admin-get-shortlinks'];

export function useAdminGetShortlinks(
  queryProps?: UseQueryOptions<AdminGetShortlinksResponse, ResponseError>
) {
  return useQuery<AdminGetShortlinksResponse, ResponseError>({
    queryKey: adminGetShortlinksKey,
    queryFn: getAdminShortlinks,
    ...queryProps,
  });
}
