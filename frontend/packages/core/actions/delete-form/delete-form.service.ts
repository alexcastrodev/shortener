import { api } from '../api';
import type { DeleteFormRequestParam } from './delete-form.types';

export async function deleteForm(id: DeleteFormRequestParam): Promise<void> {
  await api.delete(`/api/me/forms/${id}`);
}
