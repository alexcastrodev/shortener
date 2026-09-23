import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { GetPageResponse } from './get-page.types';
import type { Page } from '../../types/Page';

export async function getPage(id: number | string): Promise<Page> {
  const response: AxiosResponse<GetPageResponse> = await api.get(
    `/api/me/pages/${id}`
  );

  return response.data.page;
}
