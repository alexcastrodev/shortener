import { useMutation, type QueryClient, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { deletePageTemplate } from './delete-page-template.service';

export function useDeletePageTemplate(
  mutationProps?: UseMutationOptions<void, ResponseError, string, unknown>,
  queryClient?: QueryClient
) {
  return useMutation({ mutationFn: deletePageTemplate, ...mutationProps }, queryClient);
}
