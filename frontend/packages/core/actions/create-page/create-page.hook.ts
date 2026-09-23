import {
  useMutation,
  type QueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { createPage } from './create-page.service';
import type { CreatePageRequestBody } from './create-page.types';
import type { Page } from '../../types/Page';

export function useCreatePage(
  mutationProps?: UseMutationOptions<
    Page,
    ResponseError,
    CreatePageRequestBody,
    unknown
  >,
  queryClient?: QueryClient
) {
  return useMutation({ mutationFn: createPage, ...mutationProps }, queryClient);
}
