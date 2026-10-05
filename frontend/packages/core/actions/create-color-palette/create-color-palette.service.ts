import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  CreateColorPaletteRequestBody,
  CreateColorPaletteResponse,
} from './create-color-palette.types';
import type { ColorPalette } from '../../types/Page';

export async function createColorPalette(
  data: CreateColorPaletteRequestBody
): Promise<ColorPalette> {
  try {
    const response: AxiosResponse<CreateColorPaletteResponse> = await api.post(
      '/api/me/color_palettes',
      data
    );
    return response.data.color_palette;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw error.response?.data;
    }
    throw error;
  }
}
