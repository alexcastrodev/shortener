import { anonymous } from './api.ts';
import type { CreatedForm } from './forms.ts';

export type MailLocale = 'pt-PT' | 'en';

export type MailBooking = {
  email: string;
  name?: string;
  locale?: string | null;
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
    ...(options.locale === null ? {} : { client_locale: options.locale ?? 'pt-PT' }),
  });
}

const DAYS: Record<MailLocale, string[]> = {
  'pt-PT': ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const MONTHS: Record<MailLocale, string[]> = {
  'pt-PT': ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

export function mailDay(iso: string, locale: MailLocale = 'pt-PT') {
  const [year, month, day] = iso.split('-').map(Number);
  const weekday = DAYS[locale][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const otherYear = year === new Date().getFullYear() ? '' : locale === 'pt-PT' ? ` de ${year}` : ` ${year}`;
  return locale === 'pt-PT' ? `${weekday}, ${day} de ${MONTHS[locale][month - 1]}${otherYear}` : `${weekday} ${day} ${MONTHS[locale][month - 1]}${otherYear}`;
}

export function stamp(date: string, time: string, locale: MailLocale = 'pt-PT', minutes = 30) {
  const [hours, mins] = time.split(':').map(Number);
  const end = hours * 60 + mins + minutes;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${mailDay(date, locale)} · ${time}–${pad(Math.floor(end / 60))}:${pad(end % 60)}`;
}
