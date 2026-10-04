import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getForm } from './get-form.service';
import type { Form } from '../../types/Form';

export function getFormKey(id: number | string) {
  return ['form', String(id)];
}

export function useGetForm(
  id: number | string,
  queryProps?: UseQueryOptions<Form, ResponseError>
) {
  return useQuery<Form, ResponseError>({
    queryKey: getFormKey(id),
    queryFn: () => getForm(id),
    enabled: !!id,
    ...queryProps,
  });
}
