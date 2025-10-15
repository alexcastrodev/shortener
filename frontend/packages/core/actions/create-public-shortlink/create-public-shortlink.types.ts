import type { Shortlink } from '../../types/Shortlink';

export interface CreatePublicShortlinkRequestBody {
  title?: string;
  original_url: string;
  short_url?: string;
}

export interface CreatePublicShortlinkResponse {
  public_shortlink: Shortlink;
}
