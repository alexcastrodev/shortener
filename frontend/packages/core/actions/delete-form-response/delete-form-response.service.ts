import { api } from '../api';

export async function deleteFormResponse({
  formId,
  responseId,
}: {
  formId: number | string;
  responseId: number;
}): Promise<void> {
  await api.delete(`/api/me/forms/${formId}/responses/${responseId}`);
}
