import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  UpdateFormFieldParams,
  UpdateFormFieldResponse,
} from './update-form-field.types';
import type { Form } from '../../types/Form';

export async function updateFormField({
  formId,
  fieldId,
  data,
}: UpdateFormFieldParams): Promise<Form> {
  try {
    const response: AxiosResponse<UpdateFormFieldResponse> = await api.patch(
      `/api/me/forms/${formId}/fields/${fieldId}`,
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
