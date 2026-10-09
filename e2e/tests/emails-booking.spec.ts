import { accounts } from '../support/auth.ts';
import { nextWeekdays } from '../support/dates.ts';
import { expect, test } from '../support/fixtures.ts';
import { appointmentsOf, createForm, service, uniqueTitle } from '../support/forms.ts';
import { linkTo, linksIn, mailsTo, pathOf, subjectsTo, waitForMail } from '../support/mail.ts';
import { bookForMail, stamp } from '../support/mail-booking.ts';
import { owner } from '../support/api.ts';
import { openAgendaDay } from '../support/client-account.ts';
import { APP_URL } from '../support/env.ts';
import { uniqueEmail } from '../support/public-form.ts';

const OWNER = accounts.owner;

async function mailForm(serviceName: string, options: { rules?: Record<string, unknown> } = {}) {
  return createForm({
    emails: [{ label: 'E-mail' }],
    services: [service(serviceName)],
    rules: options.rules,
    publish: true,
  });
}

test('a booking with the confirmation address sends the client a Portuguese confirmation and the owner a new booking e-mail', async ({ page }) => {
  const serviceName = uniqueTitle('Massagem');
  const form = await mailForm(serviceName);
  const [date] = nextWeekdays(1);
  const visitor = uniqueEmail();

  expect((await bookForMail(form, { email: visitor, name: 'Rita Mail', sessions: [{ date, time: '09:00' }] })).status).toBe(201);

  const confirmation = await waitForMail(visitor, 'Confirmada');
  expect(confirmation.subject).toContain(serviceName);
  expect(confirmation.text).toContain('A sua marcação está confirmada');
  expect(confirmation.text).toContain(serviceName);
  expect(confirmation.text).toContain(stamp(date, '09:00'));
  const manage = linkTo(confirmation, 'm');
  expect(manage.startsWith(`${APP_URL}/m/`)).toBe(true);
  expect(confirmation.text).toContain(`Ver ou cancelar a sua marcação:\n${manage}\n`);
  expect(confirmation.html).toMatch(/class="tone-teal"[^>]*>Confirmada<\/span>/);
  expect(confirmation.html).toContain(`<a href="${manage}"`);

  const newBooking = await waitForMail(OWNER, 'Nova marcação');
  expect(newBooking.subject).toContain(serviceName);
  expect(newBooking.subject).toContain('Rita Mail');
  expect(newBooking.text).toContain(visitor);
  expect(newBooking.text).toContain(stamp(date, '09:00'));
  expect(linksIn(newBooking).some(link => link.startsWith(`${APP_URL}/app/forms/${form.id}/responses`))).toBe(true);

  expect(await subjectsTo(visitor)).toHaveLength(1);

  await page.goto(manage);
  await expect(page.getByRole('heading', { name: 'A sua marcação' })).toBeVisible();
  await expect(page.getByText(serviceName)).toBeVisible();
});

test('without a confirmation address only the owner is e-mailed', async () => {
  const form = await mailForm(uniqueTitle('Corte'));
  const [date] = nextWeekdays(1);
  const visitor = uniqueEmail();

  expect((await bookForMail(form, { email: visitor, confirm: false, sessions: [{ date, time: '09:00' }] })).status).toBe(201);

  await waitForMail(OWNER, 'Nova marcação');
  expect(await mailsTo(visitor)).toEqual([]);
});

test('a visitor who booked from the English page gets English, while the owner keeps Portuguese', async () => {
  const serviceName = uniqueTitle('Haircut');
  const form = await mailForm(serviceName);
  const [date] = nextWeekdays(1);
  const visitor = uniqueEmail();

  expect((await bookForMail(form, { email: visitor, locale: 'en', sessions: [{ date, time: '10:00' }] })).status).toBe(201);

  const confirmation = await waitForMail(visitor, 'Confirmed: ');
  expect(confirmation.text).toContain('Your booking is confirmed');
  expect(confirmation.text).toContain(serviceName);
  expect(confirmation.text).toContain(stamp(date, '10:00', 'en'));
  expect(confirmation.html).toMatch(/<html lang="en">/);
  expect(confirmation.text).not.toContain('A sua marcação');
  expect(pathOf(linkTo(confirmation, 'm'))).toMatch(/^\/m\//);

  const ownerMail = await waitForMail(OWNER, serviceName);
  expect(ownerMail.subject).toMatch(/^Nova marcação: /);
  expect(ownerMail.text).toContain(stamp(date, '10:00'));
});

test('a booking that names no language (API, MCP) is written in the language of the form owner', async () => {
  const serviceName = uniqueTitle('Sem idioma');
  const form = await mailForm(serviceName);
  const [date] = nextWeekdays(1);
  const visitor = uniqueEmail();

  expect((await bookForMail(form, { email: visitor, locale: null, sessions: [{ date, time: '09:00' }] })).status).toBe(201);

  const confirmation = await waitForMail(visitor, serviceName);
  expect(confirmation.subject).toMatch(/^Confirmada: /);
  expect(confirmation.text).toContain('A sua marcação está confirmada');
  expect(confirmation.text).toContain(stamp(date, '09:00'));
});

test('an owner who never chose a language gets English, until the app saves the language it shows', async ({ page, signIn }) => {
  const restore = () => owner.patch('/api/me', { locale: 'pt-PT' });
  try {
    expect((await owner.patch('/api/me', { locale: null })).status).toBe(200);
    expect((await owner.get('/api/me')).body.user.locale).toBeNull();
    const [first, second] = nextWeekdays(2);

    const before = uniqueTitle('Antes');
    expect((await bookForMail(await mailForm(before), { email: uniqueEmail(), sessions: [{ date: first, time: '09:00' }] })).status).toBe(201);
    const english = await waitForMail(OWNER, before);
    expect(english.subject).toMatch(/^New booking: /);
    expect(english.text).toContain(stamp(first, '09:00', 'en'));

    await signIn('owner');
    await page.goto('/app');
    await expect(page.getByRole('link', { name: 'Formulários' }).first()).toBeVisible();
    await expect.poll(async () => (await owner.get('/api/me')).body.user.locale).toBe('pt-PT');

    const after = uniqueTitle('Depois');
    expect((await bookForMail(await mailForm(after), { email: uniqueEmail(), locale: 'en', sessions: [{ date: second, time: '09:00' }] })).status).toBe(201);
    const portuguese = await waitForMail(OWNER, after);
    expect(portuguese.subject).toMatch(/^Nova marcação: /);
    expect(portuguese.text).toContain(stamp(second, '09:00'));
  } finally {
    await restore();
  }
});

test('a manual approval request e-mails both sides and the owner decision e-mails the client', async ({ page, signIn }) => {
  const serviceName = uniqueTitle('Consulta');
  const form = await mailForm(serviceName, { rules: { approval: 'manual' } });
  const [approvedDay, declinedDay] = nextWeekdays(2, 53);
  const visitor = uniqueEmail();

  expect((await bookForMail(form, { email: visitor, sessions: [{ date: approvedDay, time: '09:00' }] })).status).toBe(201);

  const received = await waitForMail(visitor, 'Pedido recebido');
  expect(received.text).toContain('Recebemos o seu pedido de marcação');
  expect(received.text).toContain(serviceName);
  expect(pathOf(linkTo(received, 'm'))).toMatch(/^\/m\//);
  const request = await waitForMail(OWNER, 'Marcação por aprovar');
  expect(request.text).toContain('Há uma marcação à espera da sua aprovação');
  expect(request.text).toContain(visitor);
  expect(request.text).toContain(stamp(approvedDay, '09:00'));
  expect(await subjectsTo(visitor)).toEqual([received.subject]);

  await signIn('owner');
  await openAgendaDay(page, approvedDay);
  await page.getByRole('button', { name: 'Aprovar todas (1)' }).click();
  await expect(page.getByText('1 pedido aprovado.')).toBeVisible();

  const confirmation = await waitForMail(visitor, 'Confirmada');
  expect(confirmation.text).toContain(serviceName);
  expect(confirmation.text).toContain(stamp(approvedDay, '09:00'));
  expect(pathOf(linkTo(confirmation, 'm'))).toMatch(/^\/m\//);

  expect((await bookForMail(form, { email: visitor, sessions: [{ date: declinedDay, time: '09:00' }] })).status).toBe(201);
  await expect.poll(async () => (await appointmentsOf(form.id)).map(row => row.status).sort()).toEqual(['confirmed', 'pending']);
  const pending = (await appointmentsOf(form.id)).find(row => row.status === 'pending');
  expect((await owner.post(`/api/me/appointments/${pending.id}/decline`)).status).toBe(200);

  const declined = await waitForMail(visitor, 'Não confirmada');
  expect(declined.subject).toContain(serviceName);
  expect(declined.text).toContain('O seu pedido de marcação foi recusado');
  expect(declined.text).toContain(stamp(declinedDay, '09:00'));
});

test('cancelling from the manage page e-mails the client and the owner', async ({ page }) => {
  const serviceName = uniqueTitle('Pilates');
  const form = await mailForm(serviceName);
  const [date] = nextWeekdays(1);
  const visitor = uniqueEmail();

  expect((await bookForMail(form, { email: visitor, name: 'Rita Cancela', sessions: [{ date, time: '09:00' }] })).status).toBe(201);
  const manage = linkTo(await waitForMail(visitor, 'Confirmada'), 'm');

  await page.goto(manage);
  await page.getByRole('button', { name: 'Cancelar marcação' }).click();
  await page.getByRole('button', { name: 'Sim, cancelar' }).click();

  const cancelled = await waitForMail(visitor, 'Cancelada');
  expect(cancelled.subject).toContain(serviceName);
  expect(cancelled.text).toContain('A sua marcação foi cancelada');
  expect(cancelled.text).toContain(stamp(date, '09:00'));
  const again = `${APP_URL}/f/${form.publicId}`;
  expect(cancelled.text).toContain(`Marcar novamente:\n${again}\n`);
  expect(cancelled.html).toContain(`<a href="${again}"`);
  expect(cancelled.html).toMatch(/class="tone-red"[^>]*>Cancelada<\/span>/);
  const ownerMail = await waitForMail(OWNER, 'Marcação cancelada');
  expect(ownerMail.subject).toContain(serviceName);
  expect(ownerMail.subject).toContain('Rita Cancela');
  expect(ownerMail.text).toContain('Uma marcação foi cancelada');
  expect(ownerMail.text).toContain(visitor);

  await page.goto(again);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(form.title);
  await expect(page.getByText('Escolha um horário')).toBeVisible();
});

test('two sessions in one booking produce one confirmation listing both', async () => {
  const serviceName = uniqueTitle('Curso');
  const form = await mailForm(serviceName);
  const [first, second] = nextWeekdays(2);
  const visitor = uniqueEmail();

  const booked = await bookForMail(form, {
    email: visitor,
    sessions: [
      { date: first, time: '09:00' },
      { date: second, time: '10:00' },
    ],
  });
  expect(booked.status).toBe(201);

  const confirmation = await waitForMail(visitor, 'Confirmada');
  expect(confirmation.text).toContain(stamp(first, '09:00'));
  expect(confirmation.text).toContain(stamp(second, '10:00'));
  await waitForMail(OWNER, 'Nova marcação');
  expect((await mailsTo(visitor)).filter(mail => mail.subject.includes('Confirmada'))).toHaveLength(1);
  expect((await mailsTo(OWNER)).filter(mail => mail.subject.includes('Nova marcação'))).toHaveLength(1);
});

test('a confirmed booking can still be cancelled by e-mail link once the form is closed', async ({ page }) => {
  const serviceName = uniqueTitle('Yoga');
  const form = await mailForm(serviceName);
  const [date] = nextWeekdays(1);
  const visitor = uniqueEmail();

  expect((await bookForMail(form, { email: visitor, sessions: [{ date, time: '09:00' }] })).status).toBe(201);
  const manage = linkTo(await waitForMail(visitor, 'Confirmada'), 'm');
  expect((await owner.patch(`/api/me/forms/${form.id}`, { accepting_responses: false })).status).toBe(200);

  await page.goto(manage);
  await page.getByRole('button', { name: 'Cancelar marcação' }).click();
  await page.getByRole('button', { name: 'Sim, cancelar' }).click();

  const cancelled = await waitForMail(visitor, 'Cancelada');
  expect(cancelled.subject).toContain(serviceName);
  expect(linksIn(cancelled).some(link => link.includes('/f/'))).toBe(false);
  expect((await waitForMail(OWNER, 'Marcação cancelada')).subject).toContain(serviceName);
});
