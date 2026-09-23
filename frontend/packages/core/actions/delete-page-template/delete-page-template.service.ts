import { api } from '../api';

export async function deletePageTemplate(id: string): Promise<void> {
  await api.delete(`/api/me/page_templates/${id}`);
}
