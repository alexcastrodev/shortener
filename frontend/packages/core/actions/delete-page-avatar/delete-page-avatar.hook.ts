import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { deletePageAvatar } from './delete-page-avatar.service';
import type { DeletePageAvatarRequestParam } from './delete-page-avatar.types';

export function useDeletePageAvatar(
  mutationProps?: UseMutationOptions<
    void,
    ResponseError,
    DeletePageAvatarRequestParam,
    unknown
  >
) {
  return useMutation({ mutationFn: deletePageAvatar, ...mutationProps });
}
