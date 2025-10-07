import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getShortlinks } from './get-shortlinks.service';
import type { Shortlink } from '../../types/Shortlink';

export function useGetShortlinks(
  queryProps?: UseQueryOptions<Shortlink[], ResponseError>
) {
  return useQuery<Shortlink[], ResponseError>({
    queryKey: ['shortlinks'],
    queryFn: getShortlinks,
    ...queryProps,
  });
}
