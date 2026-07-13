import { api } from '../api';

export async function deleteShortlink(id: number | string): Promise<void> {
  await api.delete(`/api/me/shortlinks/${id}`);
}
