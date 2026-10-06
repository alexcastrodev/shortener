import { useQuery } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getFormWaitlist, type OwnerWaitlistRow } from './waitlist.service';

export const getFormWaitlistKey = (formId: number | string) => [
  'form-waitlist',
  String(formId),
];

export function useGetFormWaitlist(formId: number | string, enabled: boolean) {
  return useQuery<OwnerWaitlistRow[], ResponseError>({
    queryKey: getFormWaitlistKey(formId),
    queryFn: () => getFormWaitlist(formId),
    enabled,
    retry: false,
  });
}
