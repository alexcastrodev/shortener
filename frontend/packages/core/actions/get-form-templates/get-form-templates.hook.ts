import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getFormTemplates } from './get-form-templates.service';
import type { FormTemplate } from '../../types/Form';

export const getFormTemplatesKey = ['get-form-templates'];

export function useGetFormTemplates(
  queryProps?: UseQueryOptions<FormTemplate[], ResponseError>
) {
  return useQuery<FormTemplate[], ResponseError>({
    queryKey: getFormTemplatesKey,
    queryFn: getFormTemplates,
    staleTime: Infinity,
    ...queryProps,
  });
}
