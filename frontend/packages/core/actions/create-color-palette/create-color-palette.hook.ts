import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { createColorPalette } from './create-color-palette.service';
import type { CreateColorPaletteRequestBody } from './create-color-palette.types';
import type { ColorPalette } from '../../types/Page';

export function useCreateColorPalette(
  mutationProps?: UseMutationOptions<
    ColorPalette,
    ResponseError,
    CreateColorPaletteRequestBody,
    unknown
  >
) {
  return useMutation({ mutationFn: createColorPalette, ...mutationProps });
}
