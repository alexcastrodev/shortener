import { accounts } from '../support/auth.ts';
import { anonymous, owner, waiter } from '../support/api.ts';
import { nextWeekdays } from '../support/dates.ts';
import { createForm, ownerForm, service, type CreatedForm } from '../support/forms.ts';
import { expect, test } from '../support/fixtures.ts';

const closedMessage = 'Este formulário já não aceita respostas.';

const answersFor = (form: CreatedForm, date: string, time = '09:00') => ({
  [form.nameId!]: 'Cliente E2E',
  [form.bookingId]: { service: form.serviceIds[0], sessions: [{ date, time }] },
});

const submit = (form: CreatedForm, date: string, time?: string) =>
  anonymous.post(`/api/public/forms/${form.publicId}/responses`, { answers: answersFor(form, date, time) });

test('the Aceitar respostas switch is disabled while the form is a draft', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Corte')] });
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);

  await expect(page.getByRole('switch', { name: 'Publicado' })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Aceitar respostas' })).toBeDisabled();
});

test('closing a published form shows it as closed everywhere and refuses new answers', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Corte')], publish: true });
  const [day] = nextWeekdays(1);
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);
  await expect(page.getByRole('switch', { name: 'Aceitar respostas' })).toBeChecked();

  await page.getByText('Aceitar respostas', { exact: true }).click();

  await expect(page.getByRole('switch', { name: 'Aceitar respostas' })).not.toBeChecked();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect.poll(async () => (await ownerForm(form.id)).accepting_responses).toBe(false);
  expect((await ownerForm(form.id)).published).toBe(true);

  await page.goto('/app/forms');
  await page.getByRole('textbox', { name: 'Pesquisar formulários' }).fill(form.title);
  await expect(page.getByRole('link', { name: form.title })).toHaveCount(1);
  await expect(page.getByText('Fechado', { exact: true })).toHaveCount(1);

  await page.goto(`/f/${form.publicId}`);
  await expect(page.getByRole('heading', { name: form.title })).toBeVisible();
  await expect(page.getByText(closedMessage)).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enviar' })).toHaveCount(0);

  const rejected = await submit(form, day);
  expect(rejected.status).toBe(410);
  expect(rejected.body.error).toBe('closed');

  const waitlisted = await anonymous.post(`/api/public/forms/${form.publicId}/waitlist`, {
    service: form.serviceIds[0],
    date: day,
    time: '09:00',
    name: 'Espera',
    email: accounts.waiter,
  });
  expect(waitlisted.status).toBe(410);
  expect(waitlisted.body.error).toBe('closed');
});

test('opening the form again lets the public submit', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Corte')], publish: true, accepting: false });
  const [day] = nextWeekdays(1);
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);
  await expect(page.getByRole('switch', { name: 'Aceitar respostas' })).not.toBeChecked();
  expect((await submit(form, day)).status).toBe(410);

  await page.getByText('Aceitar respostas', { exact: true }).click();

  await expect(page.getByRole('switch', { name: 'Aceitar respostas' })).toBeChecked();
  await expect.poll(async () => (await ownerForm(form.id)).accepting_responses).toBe(true);

  await page.goto(`/f/${form.publicId}`);
  await expect(page.getByText(closedMessage)).toHaveCount(0);
  await expect(page.getByText('Escolha um horário')).toBeVisible();

  const accepted = await submit(form, day);
  expect(accepted.status).toBe(201);
});

test('the public form JSON exposes whether it accepts responses', async () => {
  const form = await createForm({ services: [service('Corte')], publish: true });

  const open = await anonymous.get(`/api/public/forms/${form.publicId}`);
  expect(open.status).toBe(200);
  expect(open.body.form.accepting_responses).toBe(true);

  await owner.patch(`/api/me/forms/${form.id}`, { accepting_responses: false });
  const closed = await anonymous.get(`/api/public/forms/${form.publicId}`);
  expect(closed.status).toBe(200);
  expect(closed.body.form.accepting_responses).toBe(false);
});

test('a waitlist place that was already offered can still be claimed while the form is closed', async () => {
  const form = await createForm({
    services: [service('Corte', { capacity: 1 })],
    rules: { waitlist: true },
    publish: true,
  });
  const [day] = nextWeekdays(1);
  const serviceId = form.serviceIds[0];

  const booked = await submit(form, day);
  expect(booked.status).toBe(201);
  const manageToken = String(booked.body.manage_url).split('/m/')[1];
  expect(manageToken).toBeTruthy();

  const joined = await anonymous.post(`/api/public/forms/${form.publicId}/waitlist`, {
    service: serviceId,
    date: day,
    time: '09:00',
    name: 'Espera',
    email: accounts.waiter,
  });
  expect(joined.status).toBe(201);

  expect((await owner.patch(`/api/me/forms/${form.id}`, { accepting_responses: false })).status).toBe(200);

  const cancelled = await anonymous.post(`/api/public/appointments/${manageToken}/cancel`);
  expect(cancelled.status).toBe(200);

  const offered = async () => {
    const { body } = await waiter.get('/api/me/notifications');
    return (body.notifications as any[]).find(
      item => item.kind === 'waitlist_offered' && item.payload.form_title === form.title && item.waitlist_path,
    );
  };
  await expect.poll(offered).toBeTruthy();
  const token = (await offered()).waitlist_path.replace('/w/', '');

  const claimed = await anonymous.post(`/api/public/waitlist/${token}/claim`);
  expect(claimed.status).toBe(200);
  expect(claimed.body.result).toBe('claimed');
});
