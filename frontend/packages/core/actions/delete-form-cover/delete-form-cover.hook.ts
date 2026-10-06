import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { deleteFormCover } from './delete-form-cover.service';
import type { Form } from '../../types/Form';

export function useDeleteFormCover(
  mutationProps?: UseMutationOptions<
    Form,
    ResponseError,
    number | string,
    unknown
  >
) {
  return useMutation({ mutationFn: deleteFormCover, ...mutationProps });
}
