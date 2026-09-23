import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { createPageLink } from './create-page-link.service';
import type { CreatePageLinkParams } from './create-page-link.types';
import type { PageLink } from '../../types/Page';

export function useCreatePageLink(
  mutationProps?: UseMutationOptions<
    PageLink,
    ResponseError,
    CreatePageLinkParams,
    unknown
  >
) {
  return useMutation({ mutationFn: createPageLink, ...mutationProps });
}
