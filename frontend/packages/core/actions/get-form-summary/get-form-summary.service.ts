import { api } from '../api';
import type { FormSummary, FormSummaryPeriod } from '../../types/Form';

export async function getFormSummary(
  formId: number | string,
  days: FormSummaryPeriod
): Promise<FormSummary> {
  const response = await api.get<FormSummary>(`/api/me/forms/${formId}/summary`, {
    params: { days },
  });
  return response.data;
}
