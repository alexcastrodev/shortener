import { useInfiniteQuery } from '@tanstack/react-query';
import { getFormAppointments } from './get-form-appointments.service';
import type {
  FormAppointmentFilters,
  GetFormAppointmentsResponse,
} from './get-form-appointments.types';

export const getFormAppointmentsKey = (formId: number | string) => [
  'form-appointments',
  String(formId),
];

export function useGetFormAppointments(
  formId: number | string,
  filters: FormAppointmentFilters,
  enabled: boolean
) {
  return useInfiniteQuery<GetFormAppointmentsResponse>({
    queryKey: [...getFormAppointmentsKey(formId), filters],
    queryFn: ({ pageParam }) =>
      getFormAppointments(
        formId,
        filters,
        (pageParam as number | null) ?? null
      ),
    initialPageParam: null as number | null,
    getNextPageParam: last => last.next_before,
    enabled,
  });
}
