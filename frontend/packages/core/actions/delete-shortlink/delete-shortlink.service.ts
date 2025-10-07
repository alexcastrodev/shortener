import { api } from '../api';

export async function deleteShortlink(id: number | string): Promise<void> {
  try {
    await api.delete(`/api/me/shortlinks/${id}`);
  } catch (error) {
    throw error;
  }
}
