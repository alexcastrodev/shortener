import { AxiosError } from 'axios';
import { api } from '../api';
import type { Form } from '../../types/Form';

export async function uploadFormCover({
  id,
  file,
}: {
  id: number | string;
  file: File;
}): Promise<Form> {
  const body = new FormData();
  body.append('file', file);
  try {
    const response = await api.put<{ form: Form }>(
      `/api/me/forms/${id}/cover`,
      body
    );
    return response.data.form;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw error.response?.data;
    }
    throw error;
  }
}
