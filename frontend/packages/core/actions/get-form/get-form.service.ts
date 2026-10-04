import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { GetFormResponse } from './get-form.types';
import type { Form } from '../../types/Form';

export async function getForm(id: number | string): Promise<Form> {
  const response: AxiosResponse<GetFormResponse> = await api.get(
    `/api/me/forms/${id}`
  );

  return response.data.form;
}
