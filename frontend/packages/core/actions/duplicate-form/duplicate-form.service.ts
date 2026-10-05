import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  DuplicateFormParams,
  DuplicateFormResponse,
} from './duplicate-form.types';
import type { Form } from '../../types/Form';

export async function duplicateForm({ id }: DuplicateFormParams): Promise<Form> {
  try {
    const response: AxiosResponse<DuplicateFormResponse> = await api.post(
      `/api/me/forms/${id}/duplicate`
    );
    return response.data.form;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw error.response?.data;
    }
    throw error;
  }
}
