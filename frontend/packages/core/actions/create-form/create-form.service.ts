import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  CreateFormRequestBody,
  CreateFormResponse,
} from './create-form.types';
import type { Form } from '../../types/Form';

export async function createForm(data: CreateFormRequestBody): Promise<Form> {
  try {
    const response: AxiosResponse<CreateFormResponse> = await api.post(
      '/api/me/forms',
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
