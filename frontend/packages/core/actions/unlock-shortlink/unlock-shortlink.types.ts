export interface UnlockShortlinkParams {
  shortCode: string;
  password: string;
  referer?: string;
}

export interface UnlockShortlinkResponse {
  original_url: string;
}
