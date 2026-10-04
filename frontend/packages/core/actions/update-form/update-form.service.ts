import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../api';
import type { UpdateFormParams, UpdateFormResponse } from './update-form.types';
import type { Form } from '../../types/Form';

export async function updateForm({ id, data }: UpdateFormParams): Promise<Form> {
  try {
    const response: AxiosResponse<UpdateFormResponse> = await api.patch(
      `/api/me/forms/${id}`,
      data
    );
    return response.data.form;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw error.response?.data;
    }
    throw error;
  }
}
