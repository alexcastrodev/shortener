import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  UploadPageAvatarParams,
  UploadPageAvatarResponse,
} from './upload-page-avatar.types';
import type { Page } from '../../types/Page';

export async function uploadPageAvatar({
  pageId,
  file,
}: UploadPageAvatarParams): Promise<Page> {
  const body = new FormData();
  body.append('avatar', file);

  try {
    const response: AxiosResponse<UploadPageAvatarResponse> = await api.post(
      `/api/me/pages/${pageId}/avatar`,
      body
    );
    return response.data.page;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw error.response?.data;
    }
    throw error;
  }
}
