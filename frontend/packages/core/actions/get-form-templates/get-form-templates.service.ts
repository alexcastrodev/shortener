import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { GetFormTemplatesResponse } from './get-form-templates.types';
import type { FormTemplate } from '../../types/Form';

export async function getFormTemplates(): Promise<FormTemplate[]> {
  const response: AxiosResponse<GetFormTemplatesResponse> =
    await api.get('/api/me/form_templates');

  return response.data.form_template;
}
