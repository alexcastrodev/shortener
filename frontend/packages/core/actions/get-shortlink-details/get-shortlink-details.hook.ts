import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getShortlinkDetails } from './get-shortlink-details.service';
import type { Shortlink } from '../../types/Shortlink';

export function useGetShortlinkDetails(
  id: number | string,
  queryProps?: UseQueryOptions<Shortlink, ResponseError>
) {
  return useQuery<Shortlink, ResponseError>({
    queryKey: ['shortlink', id],
    queryFn: () => getShortlinkDetails(id),
    enabled: !!id,
    ...queryProps,
  });
}
