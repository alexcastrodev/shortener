import { expect, type Page } from '@playwright/test';
import { anonymous, owner } from './api.ts';
import { accounts } from './auth.ts';
import { dayLabel } from './calendar.ts';
import { createForm, service, type CreatedForm, type FormOptions } from './forms.ts';

export type BookOptions = {
  email?: string;
  time?: string;
  session?: { date: string; time: string }[];
  confirm?: string | null;
  name?: string;
};

export async function bookingForm(approval?: 'manual', serviceName = 'Sessão') {
  return createForm({
    name: true,
    emails: [{ label: 'E-mail' }],
    services: [service(serviceName)],
    rules: approval ? { approval } : undefined,
    publish: true,
  });
}

export async function book(form: CreatedForm, date: string, options: BookOptions = {}) {
  const email = options.email ?? accounts.client;
  const confirm = options.confirm === undefined ? form.emailIds[0] : options.confirm;
  return anonymous.post(`/api/public/forms/${form.publicId}/responses`, {
    answers: {
      [form.nameId!]: options.name ?? 'Cliente',
      [form.emailIds[0]]: email,
      [form.bookingId]: {
        service: form.serviceIds[0],
        sessions: options.session ?? [{ date, time: options.time ?? '09:00' }],
      },
    },
    ...(confirm === null ? {} : { confirm_field_id: confirm }),
    client_time_zone: 'Europe/Lisbon',
    client_locale: 'pt-PT',
  });
}

export const manageToken = (manageUrl: string) => manageUrl.split('/m/')[1];

export const notificationsOf = async (api: { get: (path: string) => Promise<{ body: any }> }) =>
  (await api.get('/api/me/notifications')).body.notifications as any[];

export const ownerAppointments = async (formId: number) =>
  (await owner.get(`/api/me/forms/${formId}/appointments`)).body.appointments as any[];

export async function openAgendaDay(page: Page, iso: string) {
  await page.goto('/app/agenda');
  await expect(page.getByRole('button', { name: /-feira, \d+ de/ }).first()).toBeVisible();
  await expect(page.getByText(/^\d+ sessões?$/)).toBeVisible();
  const target = page.getByRole('button', { name: new RegExp(`^${dayLabel(iso)}`) });
  for (let step = 0; step < 3 && (await target.count()) === 0; step++) {
    await page.getByRole('button', { name: 'Mês seguinte' }).click();
  }
  await target.click();
  await page.getByText('Dia', { exact: true }).click();
}
