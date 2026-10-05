import type { ColorPalette, CustomColors } from '../../types/Page';

export interface CreateColorPaletteRequestBody {
  name: string;
  custom_colors: CustomColors;
}

export interface CreateColorPaletteResponse {
  color_palette: ColorPalette;
}
