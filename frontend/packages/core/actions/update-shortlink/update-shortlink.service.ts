import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  UpdateShortlinkParams,
  UpdateShortlinkResponse,
} from './update-shortlink.types';
import type { Shortlink } from '../../types/Shortlink';

export async function updateShortlink({
  id,
  data,
}: UpdateShortlinkParams): Promise<Shortlink> {
  try {
    const response: AxiosResponse<UpdateShortlinkResponse> = await api.patch(
      `/api/me/shortlinks/${id}`,
      data
    );

    return response.data.shortlink;
  } catch (error) {
    throw error;
  }
}
