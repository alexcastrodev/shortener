import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { createPublicShortlink } from './create-public-shortlink.service';
import type { CreatePublicShortlinkRequestBody } from './create-public-shortlink.types';
import type { Shortlink } from '../../types/Shortlink';

export function useCreatePublicShortlink(
  mutationProps?: UseMutationOptions<
    Shortlink,
    ResponseError,
    CreatePublicShortlinkRequestBody,
    unknown
  >
) {
  return useMutation({
    mutationFn: createPublicShortlink,
    ...mutationProps,
  });
}
