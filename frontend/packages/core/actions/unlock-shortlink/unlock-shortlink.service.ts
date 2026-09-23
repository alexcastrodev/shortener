import { AxiosError, type AxiosResponse } from 'axios';
import { publicApi } from '../api';
import type {
  UnlockShortlinkParams,
  UnlockShortlinkResponse,
} from './unlock-shortlink.types';

export async function unlockShortlink({
  shortCode,
  password,
  referer,
}: UnlockShortlinkParams): Promise<UnlockShortlinkResponse> {
  try {
    const response: AxiosResponse<UnlockShortlinkResponse> =
      await publicApi.post(
        `/api/public/shortlinks/${encodeURIComponent(shortCode)}/unlock`,
        { password, referer: referer || undefined }
      );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw { ...error.response?.data, status: error.response?.status };
    }
    throw error;
  }
}
