import { api } from '../api';
import type { DeletePageLinkParams } from './delete-page-link.types';

export async function deletePageLink({
  pageId,
  id,
}: DeletePageLinkParams): Promise<void> {
  await api.delete(`/api/me/pages/${pageId}/links/${id}`);
}
