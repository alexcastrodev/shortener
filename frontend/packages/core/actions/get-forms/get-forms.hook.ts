import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getForms } from './get-forms.service';
import type { GetFormsParams, GetFormsResponse } from './get-forms.types';

export const getFormsKey = ['get-forms'];

export function useGetForms(params: GetFormsParams = {}) {
  return useQuery<GetFormsResponse, ResponseError>({
    queryKey: [...getFormsKey, params],
    queryFn: () => getForms(params),
    placeholderData: keepPreviousData,
  });
}
