import { useInfiniteQuery } from '@tanstack/react-query';
import { getFormResponses, type FormResponsesPage } from './get-form-responses.service';

export function getFormResponsesKey(formId: number | string, days?: number | 'all') {
  return days === undefined ? ['form-responses', String(formId)] : ['form-responses', String(formId), days];
}

export function useGetFormResponses(formId: number | string, days: number | 'all' = 'all') {
  return useInfiniteQuery<FormResponsesPage>({
    queryKey: getFormResponsesKey(formId, days),
    queryFn: ({ pageParam }) => getFormResponses(formId, pageParam as number | null, days),
    initialPageParam: null as number | null,
    getNextPageParam: last => last.next_before,
    enabled: !!formId,
  });
}
