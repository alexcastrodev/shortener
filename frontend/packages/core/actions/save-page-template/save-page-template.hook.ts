import { useMutation, type QueryClient, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { savePageTemplate, type SavePageTemplateParams } from './save-page-template.service';
import type { PageTemplate } from '../../types/Page';

export function useSavePageTemplate(
  mutationProps?: UseMutationOptions<PageTemplate, ResponseError, SavePageTemplateParams, unknown>,
  queryClient?: QueryClient
) {
  return useMutation({ mutationFn: savePageTemplate, ...mutationProps }, queryClient);
}
