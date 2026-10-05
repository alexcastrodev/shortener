import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { deleteFormResponse } from './delete-form-response.service';

export function useDeleteFormResponse(
  mutationProps?: UseMutationOptions<
    void,
    ResponseError,
    { formId: number | string; responseId: number },
    unknown
  >
) {
  return useMutation({ mutationFn: deleteFormResponse, ...mutationProps });
}
