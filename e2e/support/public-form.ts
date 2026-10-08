import { expect, type Locator, type Page } from '@playwright/test';
import { pickDay } from './calendar.ts';
import { anonymous, owner, waiter } from './api.ts';
import { createForm, type CreatedForm, type FormOptions } from './forms.ts';
import { isoDate } from './dates.ts';

export const uniqueEmail = (prefix = 'visitante') =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.test`;

export const shortDate = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

export function firstWeekdayOfNextMonth(): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setMonth(date.getMonth() + 1, 1);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  return isoDate(date);
}

export const monthLabel = (iso: string) =>
  new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));

export const CONFIRM_LABEL = 'Quero receber a confirmação neste e-mail';

export class PublicForm {
  constructor(
    readonly page: Page,
    readonly form: CreatedForm,
  ) {}

  async open() {
    await this.page.goto(`/f/${this.form.publicId}`);
  }

  nameBox(): Locator {
    return this.page.getByRole('textbox', { name: /^\d*Nome/ });
  }

  emailBox(label = 'E-mail'): Locator {
    return this.page.getByRole('textbox', { name: new RegExp(`^\\d*${label}$`) });
  }

  confirmBoxes(): Locator {
    return this.page.getByRole('checkbox', { name: CONFIRM_LABEL });
  }

  async chooseService(name: string) {
    await this.page.getByRole('radio', { name: new RegExp(`^${name}`) }).click();
  }

  async pickSlot(iso: string, time: string) {
    await pickDay(this.page, iso);
    await this.page.getByRole('button', { name: time, exact: true }).click();
  }

  async submit() {
    await this.page.getByRole('button', { name: 'Enviar', exact: true }).click();
  }

  receipt(): Locator {
    return this.page.getByRole('status');
  }

  async manageToken(): Promise<string> {
    const link = this.receipt().getByRole('link', { name: /\/m\// });
    await expect(link).toBeVisible();
    return (await link.getAttribute('href'))!.split('/m/')[1];
  }
}

export const WAITER_EMAIL = 'waiter-e2e@example.test';

export async function bookViaApi(form: CreatedForm, date: string, time: string, email = uniqueEmail('ocupante')) {
  const response = await anonymous.post(`/api/public/forms/${form.publicId}/responses`, {
    answers: {
      ...(form.nameId ? { [form.nameId]: 'Ocupante' } : {}),
      ...(form.emailIds[0] ? { [form.emailIds[0]]: email } : {}),
      [form.bookingId]: { service: form.serviceIds[0], sessions: [{ date, time }] },
    },
    confirm_field_id: form.emailIds[0],
    client_time_zone: 'Europe/Lisbon',
    client_locale: 'pt-PT',
  });
  if (response.status !== 201) throw new Error(`booking failed: ${response.status}`);
  return { token: String(response.body.manage_url).split('/m/')[1], body: response.body };
}

export const waiterNotificationsOf = async (form: CreatedForm) =>
  ((await waiter.get('/api/me/notifications')).body.notifications as any[]).filter(
    item => item.payload?.form_title === form.title,
  );
