import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { uploadPageAvatar } from './upload-page-avatar.service';
import type { UploadPageAvatarParams } from './upload-page-avatar.types';
import type { Page } from '../../types/Page';

export function useUploadPageAvatar(
  mutationProps?: UseMutationOptions<
    Page,
    ResponseError,
    UploadPageAvatarParams,
    unknown
  >
) {
  return useMutation({ mutationFn: uploadPageAvatar, ...mutationProps });
}
