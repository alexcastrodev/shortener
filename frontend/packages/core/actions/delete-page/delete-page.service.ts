import { api } from '../api';
import type { DeletePageRequestParam } from './delete-page.types';

export async function deletePage(id: DeletePageRequestParam): Promise<void> {
  await api.delete(`/api/me/pages/${id}`);
}
