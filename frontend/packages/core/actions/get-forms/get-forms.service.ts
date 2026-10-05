import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { GetFormsParams, GetFormsResponse } from './get-forms.types';

export async function getForms(params: GetFormsParams = {}): Promise<GetFormsResponse> {
  const response: AxiosResponse<GetFormsResponse> = await api.get('/api/me/forms', {
    params: {
      q: params.q || undefined,
      status: params.status === 'all' ? undefined : params.status,
      sort: params.sort,
    },
  });

  return response.data;
}
