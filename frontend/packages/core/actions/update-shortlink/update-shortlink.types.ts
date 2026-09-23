import type { Shortlink } from '../../types/Shortlink';

export interface UpdateShortlinkRequestBody {
  title?: string;
  original_url?: string;
  // Omit to keep the current password; null removes it.
  password?: string | null;
  expires_at?: string | null;
}

export interface UpdateShortlinkParams {
  id: number | string;
  data: UpdateShortlinkRequestBody;
}

export interface UpdateShortlinkResponse {
  shortlink: Shortlink;
}
