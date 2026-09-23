import type { Page } from '../../types/Page';

export interface UploadPageAvatarParams {
  pageId: number | string;
  file: File;
}

export interface UploadPageAvatarResponse {
  page: Page;
}
