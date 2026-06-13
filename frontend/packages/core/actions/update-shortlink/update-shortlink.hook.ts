import {
  useMutation,
  type QueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { updateShortlink } from './update-shortlink.service';
import type { UpdateShortlinkParams } from './update-shortlink.types';
import type { Shortlink } from '../../types/Shortlink';

export function useUpdateShortlink(
  mutationProps?: UseMutationOptions<
    Shortlink,
    ResponseError,
    UpdateShortlinkParams,
    unknown
  >,
  queryClient?: QueryClient
) {
  return useMutation(
    {
      mutationFn: updateShortlink,
      ...mutationProps,
    },
    queryClient
  );
}
