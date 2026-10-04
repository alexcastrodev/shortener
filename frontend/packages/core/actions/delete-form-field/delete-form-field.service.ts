import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  DeleteFormFieldParams,
  DeleteFormFieldResponse,
} from './delete-form-field.types';
import type { Form } from '../../types/Form';

export async function deleteFormField({
  formId,
  fieldId,
}: DeleteFormFieldParams): Promise<Form> {
  try {
    const response: AxiosResponse<DeleteFormFieldResponse> = await api.delete(
      `/api/me/forms/${formId}/fields/${fieldId}`
    );
    return response.data.form;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw error.response?.data;
    }
    throw error;
  }
}
