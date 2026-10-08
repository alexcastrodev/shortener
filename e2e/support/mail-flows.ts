import { expect, type Page } from '@playwright/test';
import { anonymous } from './api.ts';
import { accounts } from './auth.ts';
import { createForm, service, uniqueTitle, type CreatedForm } from './forms.ts';
import { mailsTo, type Mail } from './mail.ts';
import { PublicForm, shortDate } from './public-form.ts';

export const OWNER = accounts.owner;

export const verifyForm = (serviceName: string) =>
  createForm({
    emails: [{ label: 'O seu e-mail', required: true }],
    services: [service(serviceName)],
    rules: { verify_email: true },
    publish: true,
  });

export const bookUnverified = (form: CreatedForm, email: string, date: string, locale = 'pt-PT') =>
  anonymous.post(`/api/public/forms/${form.publicId}/responses`, {
    answers: {
      [form.nameId!]: 'Rita Verificar',
      [form.emailIds[0]]: email,
      [form.bookingId]: { service: form.serviceIds[0], sessions: [{ date, time: '09:00' }] },
    },
    client_time_zone: 'Europe/Lisbon',
    client_locale: locale,
  });

export const ownerMailsAbout = async (serviceName: string): Promise<Mail[]> =>
  (await mailsTo(OWNER)).filter(mail => mail.subject.includes(serviceName));

export async function waitlistForm() {
  const serviceName = uniqueTitle('Sessão');
  const form = await createForm({
    emails: [{ label: 'E-mail' }],
    services: [service(serviceName, { times: ['09:00'] })],
    rules: { waitlist: true, waitlist_confirm_minutes: 120 },
    publish: true,
  });
  return { form, serviceName };
}

export async function joinWaitlistThroughForm(page: Page, form: CreatedForm, day: string, email: string, name = 'Rita Espera') {
  await new PublicForm(page, form).open();
  await page.getByRole('button', { name: new RegExp(`${shortDate(day)} · 09:00$`) }).click();
  await page.getByRole('textbox', { name: 'O seu nome' }).fill(name);
  await page.getByRole('textbox', { name: 'O seu e-mail' }).fill(email);
  await page.getByRole('button', { name: 'Entrar na lista de espera' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Está na lista de espera' })).toBeVisible();
}

export const joinWaitlistViaApi = (form: CreatedForm, day: string, email: string, locale: string) =>
  anonymous.post(`/api/public/forms/${form.publicId}/waitlist`, {
    service: form.serviceIds[0],
    date: day,
    time: '09:00',
    name: 'Rita Espera',
    email,
    client_locale: locale,
    client_time_zone: 'Europe/Lisbon',
  });
