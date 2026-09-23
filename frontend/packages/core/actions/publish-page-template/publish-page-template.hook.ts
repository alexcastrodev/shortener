import {
  useMutation,
  type QueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import type { PageTemplate } from '../../types/Page';
import { publishPageTemplate } from './publish-page-template.service';
import type { PublishPageTemplateParams } from './publish-page-template.types';

export function usePublishPageTemplate(
  mutationProps?: UseMutationOptions<
    PageTemplate,
    ResponseError,
    PublishPageTemplateParams,
    unknown
  >,
  queryClient?: QueryClient
) {
  return useMutation(
    { mutationFn: publishPageTemplate, ...mutationProps },
    queryClient
  );
}
