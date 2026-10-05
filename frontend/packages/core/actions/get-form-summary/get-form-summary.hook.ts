import { useQuery } from '@tanstack/react-query';
import { getFormSummary } from './get-form-summary.service';
import type { FormSummary, FormSummaryPeriod } from '../../types/Form';

export function useGetFormSummary(formId: number | string, days: FormSummaryPeriod) {
  return useQuery<FormSummary>({
    queryKey: ['form-summary', String(formId), days],
    queryFn: () => getFormSummary(formId, days),
    enabled: !!formId,
  });
}
