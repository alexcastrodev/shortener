import { useInfiniteQuery, type QueryClient } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getCommunityTemplates } from './get-community-templates.service';
import type {
  CommunityTemplatesSort,
  GetCommunityTemplatesResponse,
} from './get-community-templates.types';

export const getCommunityTemplatesKey = ['community-templates'];

export function useGetCommunityTemplates(
  sort: CommunityTemplatesSort,
  queryClient?: QueryClient
) {
  return useInfiniteQuery<GetCommunityTemplatesResponse, ResponseError>(
    {
      queryKey: [...getCommunityTemplatesKey, sort],
      queryFn: ({ pageParam }) =>
        getCommunityTemplates(sort, pageParam as number),
      initialPageParam: 1,
      getNextPageParam: last =>
        last.meta.page * last.meta.per_page < last.meta.total
          ? last.meta.page + 1
          : undefined,
    },
    queryClient
  );
}
