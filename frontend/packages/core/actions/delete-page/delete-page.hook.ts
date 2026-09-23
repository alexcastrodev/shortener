import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { deletePage } from './delete-page.service';
import type { DeletePageRequestParam } from './delete-page.types';

export function useDeletePage(
  mutationProps?: UseMutationOptions<
    void,
    ResponseError,
    DeletePageRequestParam,
    unknown
  >
) {
  return useMutation({ mutationFn: deletePage, ...mutationProps });
}
