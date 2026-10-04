import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { GetFormsResponse } from './get-forms.types';
import type { Form } from '../../types/Form';

export async function getForms(): Promise<Form[]> {
  const response: AxiosResponse<GetFormsResponse> =
    await api.get('/api/me/forms');

  return response.data.form;
}
