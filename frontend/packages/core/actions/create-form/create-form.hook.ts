import {
  useMutation,
  type QueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { createForm } from './create-form.service';
import type { CreateFormRequestBody } from './create-form.types';
import type { Form } from '../../types/Form';

export function useCreateForm(
  mutationProps?: UseMutationOptions<
    Form,
    ResponseError,
    CreateFormRequestBody,
    unknown
  >,
  queryClient?: QueryClient
) {
  return useMutation({ mutationFn: createForm, ...mutationProps }, queryClient);
}
