import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { updatePageLink } from './update-page-link.service';
import type { UpdatePageLinkParams } from './update-page-link.types';
import type { PageLink } from '../../types/Page';

export function useUpdatePageLink(
  mutationProps?: UseMutationOptions<
    PageLink,
    ResponseError,
    UpdatePageLinkParams,
    unknown
  >
) {
  return useMutation({ mutationFn: updatePageLink, ...mutationProps });
}
