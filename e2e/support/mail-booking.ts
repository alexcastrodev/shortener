import { anonymous } from './api.ts';
import type { CreatedForm } from './forms.ts';

export type MailBooking = {
  email: string;
  name?: string;
  locale?: string;
  confirm?: boolean;
  sessions: { date: string; time: string }[];
};

export async function bookForMail(form: CreatedForm, options: MailBooking) {
  return anonymous.post(`/api/public/forms/${form.publicId}/responses`, {
    answers: {
      [form.nameId!]: options.name ?? 'Cliente Mail',
      [form.emailIds[0]]: options.email,
      [form.bookingId]: { service: form.serviceIds[0], sessions: options.sessions },
    },
    ...(options.confirm === false ? {} : { confirm_field_id: form.emailIds[0] }),
    client_time_zone: 'Europe/Lisbon',
    client_locale: options.locale ?? 'pt-PT',
  });
}

export const stamp = (date: string, time: string) => `${date} ${time}`;
