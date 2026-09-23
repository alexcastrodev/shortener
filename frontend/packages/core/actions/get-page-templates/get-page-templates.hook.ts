import { useQuery, type QueryClient } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getPageTemplates } from './get-page-templates.service';
import type { PageTemplate } from '../../types/Page';

export const getPageTemplatesKey = ['page-templates'];

export function useGetPageTemplates(queryClient?: QueryClient) {
  return useQuery<PageTemplate[], ResponseError>(
    { queryKey: getPageTemplatesKey, queryFn: getPageTemplates },
    queryClient
  );
}
