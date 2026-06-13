import type { Shortlink } from '../../types/Shortlink';

export interface UpdateShortlinkRequestBody {
  title?: string;
  original_url?: string;
}

export interface UpdateShortlinkParams {
  id: number | string;
  data: UpdateShortlinkRequestBody;
}

export interface UpdateShortlinkResponse {
  shortlink: Shortlink;
}
