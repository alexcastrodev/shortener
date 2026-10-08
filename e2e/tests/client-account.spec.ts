import { anonymous, client, owner, waiter } from '../support/api.ts';
import { accounts } from '../support/auth.ts';
import { book, bookingForm, manageToken, notificationsOf, openAgendaDay, ownerAppointments } from '../support/client-account.ts';
import { nextWeekdays } from '../support/dates.ts';
import { expect, test } from '../support/fixtures.ts';
import { uniqueTitle } from '../support/forms.ts';

const [day] = nextWeekdays(1);

test('the client sees the booking in the agenda as their own and manages it from there', async ({ context, page, signIn }) => {
  const serviceName = uniqueTitle('Consulta');
  const form = await bookingForm(undefined, serviceName);
  const booked = await book(form, day);
  expect(booked.status).toBe(201);

  await signIn('client');
  await openAgendaDay(page, day);
  await page.getByRole('button', { name: `${serviceName} 09:00 · A minha marcação` }).click();

  const panel = page.getByRole('dialog', { name: serviceName });
  await expect(panel.getByText('A minha marcação')).toBeVisible();
  await expect(panel.getByText(form.title)).toBeVisible();
  await expect(panel.getByText('Confirmada')).toBeVisible();
  await expect(panel.getByText('Quando')).toBeVisible();
  await expect(panel.getByText('Formulário')).toBeVisible();
  await expect(panel.getByText('Estado')).toBeVisible();

  const opened = context.waitForEvent('page');
  await panel.getByRole('button', { name: 'Gerir marcação' }).click();
  const manage = await opened;
  await expect(manage).toHaveURL(/\/m\/[\w-]+$/);
  await expect(manage.getByText('A sua marcação', { exact: true })).toBeVisible();
  await expect(manage.getByRole('button', { name: 'Cancelar marcação' })).toBeVisible();
});

test('the owner agenda shows the session without the client-only label', async ({ page, signIn }) => {
  const serviceName = uniqueTitle('Consulta');
  const form = await bookingForm(undefined, serviceName);
  expect((await book(form, day)).status).toBe(201);

  await signIn('owner');
  await openAgendaDay(page, day);

  await expect(page.getByRole('button', { name: new RegExp(`^${serviceName} 09:00`) })).toBeVisible();
  await expect(page.getByText('A minha marcação')).toHaveCount(0);
});

test('cancelling from the manage link notifies the owner and the client', async ({ page }) => {
  const form = await bookingForm();
  const booked = await book(form, day);
  expect(booked.status).toBe(201);
  const groupKey = (await ownerAppointments(form.id))[0].group_key;

  await page.goto(`/m/${manageToken(booked.body.manage_url)}`);
  await expect(page.getByText('A sua marcação', { exact: true })).toBeVisible();
  await expect(page.getByText('Estado')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar marcação' }).click();
  await expect(page.getByText('Cancelar esta marcação?')).toBeVisible();
  await page.getByRole('button', { name: 'Manter marcação' }).click();
  await expect(page.getByText('Cancelar esta marcação?')).toBeHidden();
  await page.getByRole('button', { name: 'Cancelar marcação' }).click();
  await page.getByRole('button', { name: 'Sim, cancelar' }).click();
  await expect(page.getByText('A sua marcação foi cancelada.')).toBeVisible();

  await expect.poll(async () => (await ownerAppointments(form.id)).map(row => row.status)).toEqual(['cancelled']);
  const ownerItems = (await notificationsOf(owner)).filter(item => item.payload.group_key === groupKey);
  expect(ownerItems.map(item => item.kind).sort()).toEqual(['appointment_cancelled', 'appointment_created']);
  expect(ownerItems.every(item => item.recipient_kind === 'owner')).toBe(true);

  const clientItems = (await notificationsOf(client)).filter(item => item.payload.group_key === groupKey);
  expect(clientItems.map(item => item.kind).sort()).toEqual(['appointment_cancelled', 'appointment_confirmed']);
  expect(clientItems.every(item => item.recipient_kind === 'client')).toBe(true);
});

test('the client notifications page lists Portuguese items and opens the agenda', async ({ page, signIn }) => {
  const form = await bookingForm();
  expect((await book(form, day)).status).toBe(201);

  await signIn('client');
  await page.goto('/app/notifications');
  await expect(page.getByRole('heading', { name: 'Notificações' })).toBeVisible();
  const item = page.getByRole('button', { name: /^A sua marcação foi confirmada · 1 sessão/ }).first();
  await expect(item).toBeVisible();

  await item.click();
  await expect(page).toHaveURL(/\/app\/agenda$/);
  await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
});

test('the account endpoints expose only the client own bookings', async () => {
  const form = await bookingForm();
  const booked = await book(form, day);
  expect(booked.status).toBe(201);
  const groupKey = (await ownerAppointments(form.id))[0].group_key;

  const mirrored = (await notificationsOf(client)).filter(item => item.payload.group_key === groupKey);
  expect(mirrored).toHaveLength(1);
  expect(mirrored[0]).toMatchObject({ kind: 'appointment_confirmed', recipient_kind: 'client' });
  expect(Object.keys(mirrored[0].payload).sort()).toEqual(['group_key', 'sessions']);

  const mine = await client.get(`/api/me/bookings?from=${day}&to=${day}`);
  expect(mine.status).toBe(200);
  expect(mine.body.bookings.find((row: any) => row.group_key === groupKey)).toMatchObject({
    form_title: form.title,
    service: 'Sessão',
    status: 'confirmed',
    cancellable: true,
    series: false,
    time_zone: 'Europe/Lisbon',
    sessions: [{ starts_at: booked.body.appointments[0].starts_at, status: 'confirmed' }],
  });

  const others = await waiter.get(`/api/me/bookings?from=${day}&to=${day}`);
  expect(others.status).toBe(200);
  expect(others.body.bookings.some((row: any) => row.group_key === groupKey)).toBe(false);
  expect((await waiter.get('/api/me/bookings')).body.bookings.some((row: any) => row.group_key === groupKey)).toBe(false);

  const foreign = await waiter.post(`/api/me/bookings/${groupKey}/manage_link`);
  expect(foreign.status).toBe(404);
  expect(foreign.body).toEqual({ error: 'not_found' });
  const own = await client.post(`/api/me/bookings/${groupKey}/manage_link`);
  expect(own.status).toBe(200);
  expect(own.body.manage_url).toContain('/m/');

  for (const range of [`from=${day}&to=2000-01-01`, 'from=nonsense&to=nonsense', `from=${day}`, `from=2026-01-01&to=2030-01-01`]) {
    const invalid = await client.get(`/api/me/bookings?${range}`);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({ error: 'invalid_range' });
  }

  expect((await anonymous.get('/api/me/bookings')).status).toBe(401);
  expect((await anonymous.post(`/api/me/bookings/${groupKey}/manage_link`)).status).toBe(401);
});

test('a booking with an e-mail that is not an account notifies only the owner', async () => {
  const form = await bookingForm();
  const stranger = `stranger-${Date.now().toString(36)}@example.test`;
  const booked = await book(form, day, { email: stranger });
  expect(booked.status).toBe(201);
  expect(booked.body.email_delivery).toBe('queued');
  const [appointment] = await ownerAppointments(form.id);
  expect(appointment.client_email).toBe(stranger);

  const ownerItems = (await notificationsOf(owner)).filter(item => item.payload.group_key === appointment.group_key);
  expect(ownerItems.map(item => item.recipient_kind)).toEqual(['owner']);
  for (const api of [client, waiter]) {
    const items = await notificationsOf(api);
    expect(items.filter(item => item.payload.group_key === appointment.group_key)).toEqual([]);
  }
  expect(accounts.client).not.toBe(stranger);
});
