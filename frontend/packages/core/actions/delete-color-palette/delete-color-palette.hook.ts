import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { deleteColorPalette } from './delete-color-palette.service';

export function useDeleteColorPalette(
  mutationProps?: UseMutationOptions<void, ResponseError, number, unknown>
) {
  return useMutation({ mutationFn: deleteColorPalette, ...mutationProps });
}
