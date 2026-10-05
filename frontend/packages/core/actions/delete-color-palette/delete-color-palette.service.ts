import { api } from '../api';

export async function deleteColorPalette(id: number): Promise<void> {
  await api.delete(`/api/me/color_palettes/${id}`);
}
