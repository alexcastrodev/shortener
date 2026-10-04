import { AxiosError } from 'axios';
import { publicApi } from '../api';
import type { PublicForm } from '../../types/Form';

export async function getPublicForm(publicId: string): Promise<PublicForm | null> {
  try {
    const response = await publicApi.get<{ form: PublicForm }>(
      `/api/public/forms/${encodeURIComponent(publicId)}`
    );
    return response.data.form;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) return null;
    throw error;
  }
}
