import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { deleteForm } from './delete-form.service';
import type { DeleteFormRequestParam } from './delete-form.types';

export function useDeleteForm(
  mutationProps?: UseMutationOptions<
    void,
    ResponseError,
    DeleteFormRequestParam,
    unknown
  >
) {
  return useMutation({ mutationFn: deleteForm, ...mutationProps });
}
