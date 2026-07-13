import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getAdminShortlinks } from './admin-shortlink.service';
import type {
  AdminGetShortlinksParams,
  AdminGetShortlinksResponse,
} from './admin-shortlink.types';

export function adminGetShortlinksKey(params?: AdminGetShortlinksParams) {
  return ['admin-get-shortlinks', params ?? {}];
}

export function useAdminGetShortlinks(
  params?: AdminGetShortlinksParams,
  queryProps?: UseQueryOptions<AdminGetShortlinksResponse, ResponseError>
) {
  return useQuery<AdminGetShortlinksResponse, ResponseError>({
    queryKey: adminGetShortlinksKey(params),
    queryFn: () => getAdminShortlinks(params),
    ...queryProps,
  });
}
