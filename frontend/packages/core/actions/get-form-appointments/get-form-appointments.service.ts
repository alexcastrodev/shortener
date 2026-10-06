import { api } from '../api';
import type {
  FormAppointmentFilters,
  GetFormAppointmentsResponse,
} from './get-form-appointments.types';

export async function getFormAppointments(
  formId: number | string,
  filters: FormAppointmentFilters,
  before: number | null
): Promise<GetFormAppointmentsResponse> {
  const response = await api.get<GetFormAppointmentsResponse>(
    `/api/me/forms/${formId}/appointments`,
    {
      params: { ...filters, before: before ?? undefined },
    }
  );
  return response.data;
}
