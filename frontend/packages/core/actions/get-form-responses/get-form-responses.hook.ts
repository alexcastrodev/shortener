import { useInfiniteQuery } from '@tanstack/react-query';
import { getFormResponses, type FormResponsesPage } from './get-form-responses.service';

export function getFormResponsesKey(formId: number | string) {
  return ['form-responses', String(formId)];
}

export function useGetFormResponses(formId: number | string) {
  return useInfiniteQuery<FormResponsesPage>({
    queryKey: getFormResponsesKey(formId),
    queryFn: ({ pageParam }) => getFormResponses(formId, pageParam as number | null),
    initialPageParam: null as number | null,
    getNextPageParam: last => last.next_before,
    enabled: !!formId,
  });
}
