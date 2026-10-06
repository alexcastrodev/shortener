import { api } from '../api';
import type { FormAppointmentFilters } from '../get-form-appointments/get-form-appointments.types';

export async function exportFormAppointments(
  formId: number | string,
  filters: FormAppointmentFilters,
  format: 'csv' | 'xlsx'
): Promise<Blob> {
  const response = await api.get<Blob>(
    `/api/me/forms/${formId}/appointments_export`,
    {
      params: { ...filters, format_type: format },
      responseType: 'blob',
    }
  );
  return response.data;
}
