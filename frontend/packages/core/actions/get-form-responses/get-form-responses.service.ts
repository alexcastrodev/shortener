import { api } from '../api';
import type { FormResponse } from '../../types/Form';

export interface FormResponsesPage {
  response: FormResponse[];
  next_before: number | null;
}

export async function getFormResponses(
  formId: number | string,
  before?: number | null
): Promise<FormResponsesPage> {
  const response = await api.get<FormResponsesPage>(
    `/api/me/forms/${formId}/responses`,
    { params: before ? { before } : undefined }
  );
  return response.data;
}
