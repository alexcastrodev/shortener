import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { ColorPalette } from '../../types/Page';

export async function getColorPalettes(): Promise<ColorPalette[]> {
  const response: AxiosResponse<{ color_palette: ColorPalette[] }> =
    await api.get('/api/me/color_palettes');

  return response.data.color_palette;
}
