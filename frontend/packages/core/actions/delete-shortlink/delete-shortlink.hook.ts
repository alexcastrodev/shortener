import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { deleteShortlink } from './delete-shortlink.service';

export function useDeleteShortlink(
  mutationProps?: UseMutationOptions<void, ResponseError, number | string, unknown>
) {
  return useMutation({
    mutationFn: deleteShortlink,
    ...mutationProps,
  });
}
