import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  CreatePageRequestBody,
  CreatePageResponse,
} from './create-page.types';
import type { Page } from '../../types/Page';

export async function createPage(data: CreatePageRequestBody): Promise<Page> {
  try {
    const response: AxiosResponse<CreatePageResponse> = await api.post(
      '/api/me/pages',
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
