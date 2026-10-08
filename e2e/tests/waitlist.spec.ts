import { anonymous } from '../support/api.ts';
import { dayLabel } from '../support/calendar.ts';
import { nextWeekdays } from '../support/dates.ts';
import { createForm, appointmentsOf, service, uniqueTitle } from '../support/forms.ts';
import { expect, test } from '../support/fixtures.ts';
import {
  bookViaApi,
  PublicForm,
  shortDate,
  WAITER_EMAIL,
  waiterNotificationsOf,
} from '../support/public-form.ts';
import type { Page } from '@playwright/test';

const waitlistRules = { waitlist: true, waitlist_confirm_minutes: 120 };

async function fullSlot(options: { rules?: Record<string, unknown> } = {}) {
  const serviceName = uniqueTitle('Sessão');
  const form = await createForm({
    layout: 'page',
    emails: [{ label: 'E-mail' }],
    services: [service(serviceName, { times: ['09:00'] })],
    rules: options.rules ?? waitlistRules,
    publish: true,
  });
  const [day] = nextWeekdays(1);
  const { token } = await bookViaApi(form, day, '09:00');
  return { form, serviceName, day, token };
}

async function joinThroughForm(page: Page, view: PublicForm, day: string, name = 'Rita Espera') {
  await view.open();
  await expect(page.getByText('O seu horário está cheio?')).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`${shortDate(day)} · 09:00$`) }).click();
  await page.getByRole('textbox', { name: 'O seu nome' }).fill(name);
  await page.getByRole('textbox', { name: 'O seu e-mail' }).fill(WAITER_EMAIL);
  await page.getByRole('button', { name: 'Entrar na lista de espera' }).click();
}

test('a full slot shows the waitlist block and the visitor joins the list', async ({ page }) => {
  const { form, day } = await fullSlot();
  const view = new PublicForm(page, form);
  const chip = page.getByRole('button', { name: new RegExp(`${shortDate(day)} · 09:00$`) });

  await view.open();
  await expect(page.getByText('O seu horário está cheio?')).toBeVisible();
  await expect(page.getByText(/Entre na lista de espera\. Se abrir um lugar avisamos por e-mail/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'O seu nome' })).toBeHidden();

  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  const join = page.getByRole('button', { name: 'Entrar na lista de espera' });
  await expect(join).toBeDisabled();
  await page.getByRole('textbox', { name: 'O seu nome' }).fill('Rita Espera');
  await page.getByRole('textbox', { name: 'O seu e-mail' }).fill(WAITER_EMAIL);
  await expect(join).toBeEnabled();
  await join.click();

  await expect(page.getByRole('status').filter({ hasText: /Está na lista de espera de .* · 09:00\. Enviámos-lhe um e-mail\./ })).toBeVisible();
  await expect(page.getByText('O seu horário está cheio?')).toBeHidden();

  await expect
    .poll(async () => (await waiterNotificationsOf(form)).map(item => item.kind))
    .toEqual(['waitlist_joined']);
});

test('cancelling the booking offers the slot and the waiter is notified without internal ids', async ({ page }) => {
  const { form, day, token } = await fullSlot();
  const view = new PublicForm(page, form);

  await joinThroughForm(page, view, day);
  await expect(page.getByRole('status').filter({ hasText: 'Está na lista de espera' })).toBeVisible();

  const cancelled = await anonymous.post(`/api/public/appointments/${token}/cancel`, { scope: 'all' });
  expect(cancelled.status).toBe(200);

  await expect
    .poll(async () => (await waiterNotificationsOf(form)).map(item => item.kind).sort())
    .toEqual(['waitlist_joined', 'waitlist_offered']);

  const offered = (await waiterNotificationsOf(form)).find(item => item.kind === 'waitlist_offered');
  expect(offered.waitlist_path).toMatch(/^\/w\/.+/);
  expect(Object.keys(offered.payload).sort()).toEqual(['form_title', 'service', 'starts_at']);
  expect(JSON.stringify(offered)).not.toMatch(/waitlist_entry_id/);
  expect(offered.payload.form_title).toBe(form.title);
  expect(new Date(offered.payload.starts_at).getTime()).toBeGreaterThan(Date.now());
});

test('the waiter opens the offer from the notifications page and claims the slot', async ({ page, signIn }) => {
  const { form, serviceName, day, token } = await fullSlot();
  const view = new PublicForm(page, form);

  await joinThroughForm(page, view, day);
  await expect(page.getByRole('status').filter({ hasText: 'Está na lista de espera' })).toBeVisible();
  await anonymous.post(`/api/public/appointments/${token}/cancel`, { scope: 'all' });
  await expect.poll(async () => (await waiterNotificationsOf(form)).length).toBe(2);

  await signIn('waiter');
  await page.goto('/app/notifications');
  await expect(page.getByRole('heading', { name: 'Notificações', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^Entrou na lista de espera de ${serviceName}`) })).toBeVisible();
  const offer = page.getByRole('button', { name: new RegExp(`^Abriu-se uma vaga para ${serviceName}`) });
  await expect(offer).toBeVisible();
  await offer.click();

  await expect(page).toHaveURL(/\/w\/.+/);
  await expect(page.getByRole('heading', { name: 'Lista de espera', level: 1 })).toBeVisible();
  await expect(page.getByText(form.title)).toBeVisible();
  await expect(page.getByText(/Há um lugar guardado para si até/)).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar a minha marcação' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'A sua marcação está confirmada.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar a minha marcação' })).toBeHidden();

  const mine = (await waiterNotificationsOf(form)).filter(item => item.kind.startsWith('waitlist'));
  expect(mine).toHaveLength(2);
  for (const item of mine) expect(item.waitlist_path).toBeUndefined();

  const claimed = (await appointmentsOf(form.id)).filter((item: any) => item.status === 'confirmed');
  expect(claimed).toHaveLength(1);
  expect(claimed[0].client_email).toBe(WAITER_EMAIL);
});

test('claiming through the API removes the path from the notifications', async ({ page }) => {
  const { form, day, token } = await fullSlot();
  const view = new PublicForm(page, form);

  await joinThroughForm(page, view, day);
  await expect(page.getByRole('status').filter({ hasText: 'Está na lista de espera' })).toBeVisible();
  await anonymous.post(`/api/public/appointments/${token}/cancel`, { scope: 'all' });
  await expect.poll(async () => (await waiterNotificationsOf(form)).length).toBe(2);

  const offered = (await waiterNotificationsOf(form)).find(item => item.kind === 'waitlist_offered');
  const waitlistToken = offered.waitlist_path.replace('/w/', '');
  const claim = await anonymous.post(`/api/public/waitlist/${waitlistToken}/claim`);
  expect(claim.status).toBe(200);

  for (const item of await waiterNotificationsOf(form)) expect(item.waitlist_path).toBeUndefined();
});

test('without the waitlist rule a full slot shows no waitlist block', async ({ page }) => {
  const { form, day } = await fullSlot({ rules: { waitlist: false } });
  const view = new PublicForm(page, form);

  await view.open();
  await expect(page.getByRole('button', { name: dayLabel(nextWeekdays(2)[1]), exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: dayLabel(day), exact: true })).toBeDisabled();
  await expect(page.getByText('O seu horário está cheio?')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Entrar na lista de espera' })).toBeHidden();
});
