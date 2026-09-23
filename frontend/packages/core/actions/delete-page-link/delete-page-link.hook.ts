import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { deletePageLink } from './delete-page-link.service';
import type { DeletePageLinkParams } from './delete-page-link.types';

export function useDeletePageLink(
  mutationProps?: UseMutationOptions<
    void,
    ResponseError,
    DeletePageLinkParams,
    unknown
  >
) {
  return useMutation({ mutationFn: deletePageLink, ...mutationProps });
}
