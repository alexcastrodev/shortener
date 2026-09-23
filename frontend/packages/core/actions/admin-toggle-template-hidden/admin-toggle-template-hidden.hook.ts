import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { toggleTemplateHidden } from './admin-toggle-template-hidden.service';
import type { AdminToggleTemplateHiddenResponse } from './admin-toggle-template-hidden.types';

export function useToggleTemplateHidden(
  mutationProps?: UseMutationOptions<
    AdminToggleTemplateHiddenResponse,
    ResponseError,
    number,
    unknown
  >
) {
  return useMutation({ mutationFn: toggleTemplateHidden, ...mutationProps });
}
