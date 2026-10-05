import { useQuery, type QueryClient } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getColorPalettes } from './get-color-palettes.service';
import type { ColorPalette } from '../../types/Page';

export const getColorPalettesKey = ['color-palettes'];

export function useGetColorPalettes(queryClient?: QueryClient) {
  return useQuery<ColorPalette[], ResponseError>(
    { queryKey: getColorPalettesKey, queryFn: getColorPalettes },
    queryClient
  );
}
