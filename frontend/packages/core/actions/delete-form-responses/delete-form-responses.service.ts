import { api } from '../api';

export async function deleteFormResponses(formId: number | string): Promise<void> {
  await api.delete(`/api/me/forms/${formId}/responses`);
}
