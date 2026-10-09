import { anonymous, owner } from '../support/api.ts';
import { nextWeekdays } from '../support/dates.ts';
import { expect, test } from '../support/fixtures.ts';
import { appointmentsOf, uniqueTitle } from '../support/forms.ts';
import { linkTo, mailsTo, pathOf, subjectsTo, waitForMail } from '../support/mail.ts';
import {
  bookUnverified,
  joinWaitlistThroughForm,
  joinWaitlistViaApi,
  OWNER,
  ownerMailsAbout,
  verifyForm,
  waitlistForm,
} from '../support/mail-flows.ts';
import { bookViaApi, PublicForm, uniqueEmail } from '../support/public-form.ts';
import { stamp } from '../support/mail-booking.ts';

const [day] = nextWeekdays(1);

test('e-mail verification: the visitor confirms from the mail, then gets the confirmation and the owner the new booking', async ({ page }) => {
  const serviceName = uniqueTitle('Verificar');
  const form = await verifyForm(serviceName);
  const view = new PublicForm(page, form);
  const address = uniqueEmail('verificar');

  await view.open();
  await view.nameBox().fill('Rita Verificar');
  await view.emailBox('O seu e-mail').fill(address);
  await view.pickSlot(day, '09:00');
  await view.submit();
  await expect(page.getByRole('heading', { name: 'Obrigado' })).toBeVisible();
  await expect(view.receipt().getByText(/ainda não está confirmada/)).toBeVisible();

  const verification = await waitForMail(address, 'Confirme a sua marcação');
  expect(verification.subject).toContain(serviceName);
  expect(verification.text).toContain('Confirme o seu e-mail para manter a marcação');
  expect(verification.text).toContain(stamp(day, '09:00'));
  const link = linkTo(verification, 'v');
  expect(verification.html).toContain(`<a href="${link}"`);
  expect(verification.html).toMatch(/class="tone-amber"[^>]*>Por confirmar<\/span>/);
  expect(pathOf(link)).toMatch(/^\/v\/.+/);
  expect(await subjectsTo(address)).toEqual([verification.subject]);

  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Confirme a sua marcação', level: 1 })).toBeVisible();
  await expect(page.getByText(serviceName)).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar a minha marcação' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'A sua marcação está confirmada.' })).toBeVisible();

  const [appointment] = await appointmentsOf(form.id);
  expect(appointment.status).toBe('confirmed');
  expect(appointment.client_email).toBe(address);

  const confirmation = await waitForMail(address, 'Confirmada');
  expect(confirmation.subject).toContain(serviceName);
  expect(confirmation.text).toContain('A sua marcação está confirmada');
  expect(pathOf(linkTo(confirmation, 'm'))).toMatch(/^\/m\/.+/);

  const newBooking = await waitForMail(OWNER, serviceName);
  expect(newBooking.subject).toContain('Nova marcação');
  expect(newBooking.subject).toContain('Rita Verificar');
  expect(newBooking.text).toContain(address);

  await page.goto(link);
  await expect(page.getByRole('status').filter({ hasText: 'A sua marcação está confirmada.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar a minha marcação' })).toBeHidden();
});

test('the confirm button disappears as soon as the booking is confirmed', async ({ page }) => {
  const form = await verifyForm(uniqueTitle('Verificar'));
  const address = uniqueEmail('verificar');
  expect((await bookUnverified(form, address, day)).status).toBe(201);

  await page.goto(linkTo(await waitForMail(address, 'Confirme a sua marcação'), 'v'));
  await page.getByRole('button', { name: 'Confirmar a minha marcação' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'A sua marcação está confirmada.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar a minha marcação' })).toBeHidden();
});

test('an unverified booking is not announced to the owner until the visitor confirms', async () => {
  const serviceName = uniqueTitle('Pendente');
  const form = await verifyForm(serviceName);
  const address = uniqueEmail('pendente');

  expect((await bookUnverified(form, address, day)).status).toBe(201);

  const verification = await waitForMail(address, 'Confirme a sua marcação');
  expect(await subjectsTo(address)).toEqual([verification.subject]);
  expect(await ownerMailsAbout(serviceName)).toHaveLength(0);
  expect((await appointmentsOf(form.id)).map((row: any) => row.status)).toEqual(['unverified']);
  const groupKey = (await appointmentsOf(form.id))[0].group_key;
  const announced = ((await owner.get('/api/me/notifications')).body.notifications as any[]).filter(
    item => item.payload?.group_key === groupKey,
  );
  expect(announced).toHaveLength(0);

  const token = pathOf(linkTo(verification, 'v')).split('/v/')[1];
  const confirmed = await anonymous.post(`/api/public/appointment_verifications/${token}`);
  expect(confirmed.body.result).toBe('verified');

  const newBooking = await waitForMail(OWNER, serviceName);
  expect(newBooking.subject).toContain('Nova marcação');
  await waitForMail(address, 'Confirmada');
  expect(await ownerMailsAbout(serviceName)).toHaveLength(1);
});

test('a visitor whose booking is in English gets the verification and confirmation e-mails in English', async ({ page }) => {
  const serviceName = uniqueTitle('Verify');
  const form = await verifyForm(serviceName);
  const address = uniqueEmail('english');

  expect((await bookUnverified(form, address, day, 'en')).status).toBe(201);

  const verification = await waitForMail(address, 'Confirm your booking');
  expect(verification.subject).toContain(serviceName);
  expect(verification.text).toContain(`Confirm my email address:\n${linkTo(verification, 'v')}\n`);
  expect(verification.text).toContain('The place is held for 15 minutes.');
  expect(verification.text).toContain(stamp(day, '09:00', 'en'));
  expect(verification.text).not.toContain('Confirme');

  await page.goto(linkTo(verification, 'v'));
  await page.getByRole('button', { name: 'Confirmar a minha marcação' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'A sua marcação está confirmada.' })).toBeVisible();

  const confirmation = await waitForMail(address, 'Confirmed:');
  expect(confirmation.text).toContain('Your booking is confirmed');
  expect(confirmation.text).not.toContain('confirmada');
});

test('the waiting list mails: joined, a place opened, claimed, and the cancelled client is told too', async ({ page }) => {
  const { form, serviceName } = await waitlistForm();
  const occupant = uniqueEmail('ocupante');
  const waiting = uniqueEmail('espera');
  await bookViaApi(form, day, '09:00', occupant);
  const booked = await waitForMail(occupant, 'Confirmada');

  await joinWaitlistThroughForm(page, form, day, waiting);
  const joined = await waitForMail(waiting, 'Está na lista de espera');
  expect(joined.subject).toContain(serviceName);
  expect(joined.text).toContain('Sair da lista de espera');
  const joinedLink = linkTo(joined, 'w');
  expect(pathOf(joinedLink)).toMatch(/^\/w\/.+/);

  await page.goto(linkTo(booked, 'm'));
  await page.getByRole('button', { name: 'Cancelar marcação' }).click();
  await page.getByRole('button', { name: 'Sim, cancelar' }).click();
  await expect(page.getByText('A sua marcação foi cancelada.')).toBeVisible();

  const cancelled = await waitForMail(occupant, 'Cancelada');
  expect(cancelled.subject).toContain(serviceName);
  expect(cancelled.text).toContain('A sua marcação foi cancelada');

  const offered = await waitForMail(waiting, 'Abriu um lugar');
  expect(offered.subject).toContain(serviceName);
  expect(offered.text).toContain('Abriu um lugar para si');
  expect(offered.text).toContain(stamp(day, '09:00'));
  const offerLink = linkTo(offered, 'w');
  expect(offered.text).toContain(`Confirmar o meu lugar:\n${offerLink}\n`);
  expect(pathOf(offerLink)).toBe(pathOf(joinedLink));

  await page.goto(offerLink);
  await expect(page.getByRole('heading', { name: 'Lista de espera', level: 1 })).toBeVisible();
  await expect(page.getByText(/Há um lugar guardado para si até/)).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar a minha marcação' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'A sua marcação está confirmada.' })).toBeVisible();

  const confirmed = (await appointmentsOf(form.id)).filter((row: any) => row.status === 'confirmed');
  expect(confirmed).toHaveLength(1);
  expect(confirmed[0].client_email).toBe(waiting);

  const confirmation = await waitForMail(waiting, 'Confirmada');
  expect(confirmation.subject).toContain(serviceName);
  expect(pathOf(linkTo(confirmation, 'm'))).toMatch(/^\/m\/.+/);
});

test('leaving the waiting list from the mail link removes the entry and no place is offered to that person', async ({ page }) => {
  const { form } = await waitlistForm();
  const occupant = uniqueEmail('ocupante');
  const waiting = uniqueEmail('espera');
  const { token } = await bookViaApi(form, day, '09:00', occupant);

  await joinWaitlistThroughForm(page, form, day, waiting);
  const joined = await waitForMail(waiting, 'Está na lista de espera');
  const link = linkTo(joined, 'w');
  const waitlistToken = pathOf(link).split('/w/')[1];
  expect((await anonymous.get(`/api/public/waitlist/${waitlistToken}`)).body.waitlist.status).toBe('waiting');

  await page.goto(link);
  await expect(page.getByText('Está na fila.')).toBeVisible();
  await page.getByRole('button', { name: 'Sair da lista de espera' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saiu da lista de espera.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sair da lista de espera' })).toBeHidden();

  expect((await anonymous.get(`/api/public/waitlist/${waitlistToken}`)).body.waitlist.status).toBe('left');

  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'Saiu da lista de espera.' })).toBeVisible();

  expect((await anonymous.post(`/api/public/appointments/${token}/cancel`, { scope: 'all' })).status).toBe(200);
  await waitForMail(occupant, 'Cancelada');
  expect(await subjectsTo(waiting)).toHaveLength(1);
});

test('a waiting list entry in English gets the joined and the place opened e-mails in English', async () => {
  const { form, serviceName } = await waitlistForm();
  const occupant = uniqueEmail('ocupante');
  const waiting = uniqueEmail('waiting');
  const { token } = await bookViaApi(form, day, '09:00', occupant);

  expect((await joinWaitlistViaApi(form, day, waiting, 'en')).status).toBe(201);
  const joined = await waitForMail(waiting, 'You are on the waiting list');
  expect(joined.subject).toContain(serviceName);
  expect(pathOf(linkTo(joined, 'w'))).toMatch(/^\/w\/.+/);

  await anonymous.post(`/api/public/appointments/${token}/cancel`, { scope: 'all' });
  const offered = await waitForMail(waiting, 'A place opened');
  expect(offered.text).toContain('A place opened for you');
  expect(offered.text).not.toContain('Abriu');
  expect(await mailsTo(waiting)).toHaveLength(2);
});

test('signing in with the e-mailed code: a wrong code is refused, the right one opens the app', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'E-mail' }).fill(OWNER);
  await page.getByRole('button', { name: 'Receber um código por e-mail' }).click();

  await expect(page).toHaveURL(/\/login-confirmation$/);
  await expect(page.getByRole('heading', { name: 'Verifique o seu e-mail' })).toBeVisible();
  await expect(page.getByText(OWNER)).toBeVisible();

  const mail = await waitForMail(OWNER, 'é o seu código de acesso ao Kurz');
  const code = mail.subject.match(/^(\d{7}) /)?.[1];
  expect(code).toBeDefined();
  expect(mail.text).toContain(code!);
  const wrong = code === '0000000' ? '1111111' : '0000000';

  await page.getByRole('textbox').first().click();
  await page.keyboard.type(wrong);
  await expect(page.getByText('Código errado')).toBeVisible();
  await expect(page).toHaveURL(/\/login-confirmation$/);
  expect((await page.context().cookies()).some(cookie => cookie.name === 'kurz_session')).toBe(false);

  await page.getByRole('textbox').first().click();
  await page.keyboard.type(code!);
  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByRole('link', { name: 'Formulários' }).first()).toBeVisible();
  expect((await page.context().cookies()).some(cookie => cookie.name === 'kurz_session')).toBe(true);

  await page.goto('/app/forms');
  await expect(page).toHaveURL(/\/app\/forms/);
  await expect(page.getByRole('link', { name: 'Formulários' }).first()).toBeVisible();
});
