import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { deleteFormResponses } from './delete-form-responses.service';

export function useDeleteFormResponses(
  mutationProps?: UseMutationOptions<void, ResponseError, number | string, unknown>
) {
  return useMutation({ mutationFn: deleteFormResponses, ...mutationProps });
}
