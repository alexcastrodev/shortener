import type { Shortlink } from '../../types/Shortlink';

export interface CreateShortlinkRequestBody {
  title?: string;
  original_url: string;
}

export interface CreateShortlinkResponse {
  shortlink: Shortlink;
}
