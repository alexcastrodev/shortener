import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  CreateFormFieldParams,
  CreateFormFieldResponse,
} from './create-form-field.types';
import type { Form } from '../../types/Form';

export async function createFormField({
  formId,
  data,
}: CreateFormFieldParams): Promise<Form> {
  try {
    const response: AxiosResponse<CreateFormFieldResponse> = await api.post(
      `/api/me/forms/${formId}/fields`,
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
