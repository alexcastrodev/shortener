import { api } from '../api';
import type { DeletePageAvatarRequestParam } from './delete-page-avatar.types';

export async function deletePageAvatar(
  pageId: DeletePageAvatarRequestParam
): Promise<void> {
  await api.delete(`/api/me/pages/${pageId}/avatar`);
}
