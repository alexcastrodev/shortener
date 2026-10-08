import { client, owner } from '../support/api.ts';
import { book, bookingForm, notificationsOf, openAgendaDay, ownerAppointments } from '../support/client-account.ts';
import { nextWeekdays } from '../support/dates.ts';
import { expect, test } from '../support/fixtures.ts';
import { uniqueTitle } from '../support/forms.ts';

const [day] = nextWeekdays(1, 52);

test('a pending request raises the counter and Aprovar todas confirms it', async ({ page, signIn }) => {
  const form = await bookingForm('manual', uniqueTitle('Consulta'));
  const booked = await book(form, day);
  expect(booked.status).toBe(201);
  expect(booked.body.appointments[0].status).toBe('pending');
  const [appointment] = await ownerAppointments(form.id);
  expect(appointment.status).toBe('pending');

  await signIn('owner');
  await openAgendaDay(page, day);
  await expect(page.getByText('A aguardar aprovação')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aprovar todas (1)' })).toBeVisible();

  await page.getByRole('button', { name: 'Aprovar todas (1)' }).click();
  await expect(page.getByText('1 pedido aprovado.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Aprovar todas/ })).toBeHidden();

  await expect.poll(async () => (await ownerAppointments(form.id)).map(row => row.status)).toEqual(['confirmed']);
  const items = (await notificationsOf(client)).filter(item => item.payload.group_key === appointment.group_key);
  expect(items.map(item => item.kind).sort()).toEqual(['appointment_confirmed', 'appointment_request_received']);
  expect(items.every(item => item.recipient_kind === 'client')).toBe(true);
});

test('two pending requests are approved together with the plural toast', async ({ page, signIn }) => {
  const form = await bookingForm('manual', uniqueTitle('Consulta'));
  expect((await book(form, day)).status).toBe(201);
  expect((await book(form, day, { time: '10:00' })).status).toBe(201);
  expect((await ownerAppointments(form.id)).map(row => row.status)).toEqual(['pending', 'pending']);

  await signIn('owner');
  await openAgendaDay(page, day);
  await expect(page.getByRole('button', { name: 'Aprovar todas (2)' })).toBeVisible();

  await page.getByRole('button', { name: 'Aprovar todas (2)' }).click();
  await expect(page.getByText('2 pedidos aprovados.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Aprovar todas/ })).toBeHidden();

  await expect.poll(async () => (await ownerAppointments(form.id)).map(row => row.status)).toEqual(['confirmed', 'confirmed']);
  const confirmed = (await notificationsOf(client)).filter(item => item.kind === 'appointment_confirmed' && item.payload.group_key !== undefined);
  const groups = (await ownerAppointments(form.id)).map(row => row.group_key);
  expect(confirmed.filter(item => groups.includes(item.payload.group_key))).toHaveLength(2);
});

test('the pending counter drops to zero and the session loses its pending mark', async ({ page, signIn }) => {
  const serviceName = uniqueTitle('Consulta');
  const form = await bookingForm('manual', serviceName);
  expect((await book(form, day)).status).toBe(201);

  await signIn('owner');
  await openAgendaDay(page, day);
  const counter = page.getByRole('button', { name: /^A aguardar aprovação/ });
  await expect(counter).toHaveText(/1$/);
  const event = page.getByRole('button', { name: new RegExp(`^${serviceName} 09:00`) });
  await expect(event).toContainText('1 pendente');

  await page.getByRole('button', { name: 'Aprovar todas (1)' }).click();
  await expect(page.getByText('1 pedido aprovado.')).toBeVisible();
  await expect(counter).toHaveText(/0$/);
  await expect(event).not.toContainText('pendente');
});
