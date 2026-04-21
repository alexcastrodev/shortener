import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { toggleShortlinkActive } from './admin-shortlink-toggle-active.service';
import type { AdminToggleActiveResponse } from './admin-shortlink-toggle-active.types';

export function useToggleShortlinkActive(
  mutationProps?: UseMutationOptions<
    AdminToggleActiveResponse,
    ResponseError,
    number | string,
    unknown
  >
) {
  return useMutation({
    mutationFn: toggleShortlinkActive,
    ...mutationProps,
  });
}
