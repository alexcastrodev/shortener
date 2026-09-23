import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { unlockShortlink } from './unlock-shortlink.service';
import type {
  UnlockShortlinkParams,
  UnlockShortlinkResponse,
} from './unlock-shortlink.types';

export function useUnlockShortlink(
  mutationProps?: UseMutationOptions<
    UnlockShortlinkResponse,
    ResponseError & { status?: number },
    UnlockShortlinkParams,
    unknown
  >
) {
  return useMutation({ mutationFn: unlockShortlink, ...mutationProps });
}
