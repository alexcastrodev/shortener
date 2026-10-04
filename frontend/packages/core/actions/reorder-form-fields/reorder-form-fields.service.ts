import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  ReorderFormFieldsParams,
  ReorderFormFieldsResponse,
} from './reorder-form-fields.types';
import type { Form } from '../../types/Form';

export async function reorderFormFields({
  formId,
  ids,
}: ReorderFormFieldsParams): Promise<Form> {
  try {
    const response: AxiosResponse<ReorderFormFieldsResponse> = await api.patch(
      `/api/me/forms/${formId}/fields/reorder`,
      { ids }
    );
    return response.data.form;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw error.response?.data;
    }
    throw error;
  }
}
