import { useMutation, type QueryClient, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { applyPageTemplate, type ApplyPageTemplateParams } from './apply-page-template.service';
import type { Page } from '../../types/Page';

export function useApplyPageTemplate(
  mutationProps?: UseMutationOptions<Page, ResponseError, ApplyPageTemplateParams, unknown>,
  queryClient?: QueryClient
) {
  return useMutation({ mutationFn: applyPageTemplate, ...mutationProps }, queryClient);
}
