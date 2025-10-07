import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { createShortlink } from './create-shortlink.service';
import type { CreateShortlinkRequestBody } from './create-shortlink.types';
import type { Shortlink } from '../../types/Shortlink';

export function useCreateShortlink(
  mutationProps?: UseMutationOptions<
    Shortlink,
    ResponseError,
    CreateShortlinkRequestBody,
    unknown
  >
) {
  return useMutation({
    mutationFn: createShortlink,
    ...mutationProps,
  });
}
