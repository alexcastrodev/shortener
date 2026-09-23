import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  UpdatePageParams,
  UpdatePageResponse,
} from './update-page.types';
import type { Page } from '../../types/Page';

export async function updatePage({ id, data }: UpdatePageParams): Promise<Page> {
  try {
    const response: AxiosResponse<UpdatePageResponse> = await api.patch(
      `/api/me/pages/${id}`,
      data
    );
    return response.data.page;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw error.response?.data;
    }
    throw error;
  }
}
