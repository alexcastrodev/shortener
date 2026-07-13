import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { toggleUserActive } from './admin-user-toggle-active.service';
import type { AdminUserToggleActiveResponse } from './admin-user-toggle-active.types';

export function useToggleUserActive(
  mutationProps?: UseMutationOptions<
    AdminUserToggleActiveResponse,
    ResponseError,
    number | string,
    unknown
  >
) {
  return useMutation({
    mutationFn: toggleUserActive,
    ...mutationProps,
  });
}
