import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getForms } from './get-forms.service';
import type { Form } from '../../types/Form';

export const getFormsKey = ['get-forms'];

export function useGetForms(queryProps?: UseQueryOptions<Form[], ResponseError>) {
  return useQuery<Form[], ResponseError>({
    queryKey: getFormsKey,
    queryFn: getForms,
    ...queryProps,
  });
}
