import { AxiosError } from 'axios';
import { api } from '../api';
import type { Form } from '../../types/Form';

export async function deleteFormCover(id: number | string): Promise<Form> {
  try {
    const response = await api.delete<{ form: Form }>(
      `/api/me/forms/${id}/cover`
    );
    return response.data.form;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw error.response?.data;
    }
    throw error;
  }
}
