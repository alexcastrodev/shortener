import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { toggleShortlinkSafe } from './admin-shortlink-toggle-safe.service';
import type { AdminToggleSafeResponse } from './admin-shortlink-toggle-safe.types';

export function useToggleShortlinkSafe(
  mutationProps?: UseMutationOptions<
    AdminToggleSafeResponse,
    ResponseError,
    number | string,
    unknown
  >
) {
  return useMutation({
    mutationFn: toggleShortlinkSafe,
    ...mutationProps,
  });
}
