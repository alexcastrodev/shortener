import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { GetPagesResponse } from './get-pages.types';
import type { Page } from '../../types/Page';

export async function getPages(): Promise<Page[]> {
  const response: AxiosResponse<GetPagesResponse> =
    await api.get('/api/me/pages');

  return response.data.page;
}
