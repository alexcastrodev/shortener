import { anonymous, owner } from '../support/api.ts';
import { accounts } from '../support/auth.ts';
import { book, bookingForm, manageToken, ownerAppointments } from '../support/client-account.ts';
import { nextWeekdays } from '../support/dates.ts';
import { expect, test } from '../support/fixtures.ts';
import { createForm, ownerForm, service } from '../support/forms.ts';

const [day] = nextWeekdays(1);

test('publishing needs no name or e-mail question and a service without times is blocked', async () => {
  const plain = await createForm({ name: false, services: [service('Corte')] });
  const published = await owner.post(`/api/me/forms/${plain.id}/publish`);
  expect(published.status).toBe(200);
  expect((await ownerForm(plain.id)).published).toBe(true);

  const incomplete = await createForm({ name: false, services: [service('Vazio', { times: [] })] });
  const blocked = await owner.post(`/api/me/forms/${incomplete.id}/publish`);
  expect(blocked.status).toBe(422);
  expect(blocked.body.blocks).toHaveLength(1);
  expect(blocked.body.blocks[0]).toMatchObject({ code: 'service_incomplete', name: 'Vazio', service_id: incomplete.serviceIds[0] });
  expect((await ownerForm(incomplete.id)).published).toBe(false);
});

test('the confirmation e-mail is taken from the chosen e-mail question only', async () => {
  const chosen = await bookingForm();
  const result = await book(chosen, day);
  expect(result.status).toBe(201);
  expect(result.body.email_delivery).toBe('queued');
  expect(result.body.manage_url).toContain('/m/');
  expect(await ownerAppointments(chosen.id)).toMatchObject([{ client_email: accounts.client, status: 'confirmed' }]);

  const absent = await bookingForm();
  const withoutField = await book(absent, day, { confirm: null });
  expect(withoutField.status).toBe(201);
  expect(withoutField.body.email_delivery).toBe('none');
  expect((await ownerAppointments(absent.id))[0].client_email).toBeNull();

  const unknown = await bookingForm();
  const unknownField = await book(unknown, day, { confirm: 'nope1234' });
  expect(unknownField.status).toBe(201);
  expect(unknownField.body.email_delivery).toBe('none');
  expect((await ownerAppointments(unknown.id))[0].client_email).toBeNull();

  const notEmail = await bookingForm();
  const nameField = await book(notEmail, day, { confirm: notEmail.nameId });
  expect(nameField.status).toBe(201);
  expect(nameField.body.email_delivery).toBe('none');
  expect((await ownerAppointments(notEmail.id))[0].client_email).toBeNull();

  const blank = await bookingForm();
  const blankField = await book(blank, day, { confirm: '' });
  expect(blankField.status).toBe(201);
  expect(blankField.body.email_delivery).toBe('none');
  expect((await ownerAppointments(blank.id))[0].client_email).toBeNull();
});

test('a closed form refuses answers and waitlist joins but keeps existing manage links working', async () => {
  const form = await bookingForm();
  const booked = await book(form, day);
  expect(booked.status).toBe(201);

  const closed = await owner.patch(`/api/me/forms/${form.id}`, { accepting_responses: false });
  expect(closed.status).toBe(200);

  const refused = await book(form, day, { time: '10:00' });
  expect(refused.status).toBe(410);
  expect(refused.body).toEqual({ error: 'closed' });

  const waitlist = await anonymous.post(`/api/public/forms/${form.publicId}/waitlist`, {
    service: form.serviceIds[0],
    date: day,
    time: '09:00',
    name: 'Espera',
    email: 'espera@example.test',
    client_locale: 'pt-PT',
    client_time_zone: 'Europe/Lisbon',
  });
  expect(waitlist.status).toBe(410);
  expect(waitlist.body).toEqual({ error: 'closed' });

  const publicForm = await anonymous.get(`/api/public/forms/${form.publicId}`);
  expect(publicForm.status).toBe(200);
  expect(publicForm.body.form.accepting_responses).toBe(false);

  const token = manageToken(booked.body.manage_url);
  const manage = await anonymous.get(`/api/public/appointments/${token}`);
  expect(manage.status).toBe(200);
  expect(manage.body.appointment.form_title).toBe(form.title);
});

test('closing a form keeps it published, reopening works and a null flag is rejected', async () => {
  const form = await bookingForm();

  const closed = await owner.patch(`/api/me/forms/${form.id}`, { accepting_responses: false });
  expect(closed.status).toBe(200);
  const afterClosing = await ownerForm(form.id);
  expect(afterClosing.published).toBe(true);
  expect(afterClosing.accepting_responses).toBe(false);

  const invalid = await owner.patch(`/api/me/forms/${form.id}`, { accepting_responses: null });
  expect(invalid.status).toBe(422);
  expect((await ownerForm(form.id)).accepting_responses).toBe(false);

  const reopened = await owner.patch(`/api/me/forms/${form.id}`, { accepting_responses: true });
  expect(reopened.status).toBe(200);
  expect((await ownerForm(form.id)).accepting_responses).toBe(true);
  expect((await book(form, day)).status).toBe(201);
});

test('repeated public submissions end in a 429 rate_limited answer', async () => {
  const form = await bookingForm();
  const statuses: number[] = [];
  let last: { status: number; body: any } | undefined;
  for (let attempt = 0; attempt < 8 && last?.status !== 429; attempt++) {
    last = await anonymous.post(`/api/public/forms/${form.publicId}/responses`, { answers: {} });
    statuses.push(last.status);
  }
  expect(statuses.at(-1)).toBe(429);
  expect(last?.body).toEqual({ error: 'rate_limited' });
  expect(statuses.slice(0, -1).every(status => status !== 429)).toBe(true);
});

test('a service without a limit takes any number of bookings at the same time, a limited one does not', async () => {
  const open = await createForm({
    name: true,
    emails: [{ label: 'E-mail' }],
    services: [service('Aula livre', { capacity: null })],
    publish: true,
  });
  for (const name of ['Ana', 'Rui', 'Eva']) {
    const booked = await book(open, day, { email: `${name.toLowerCase()}-livre@example.test`, name, confirm: null });
    expect(booked.status).toBe(201);
  }
  const slots = await anonymous.get(`/api/public/forms/${open.publicId}/slots?service=${open.serviceIds[0]}&from=${day}&to=${day}`);
  expect(slots.body.slots.map((slot: { time: string }) => slot.time)).toContain('09:00');

  const single = await createForm({
    name: true,
    emails: [{ label: 'E-mail' }],
    services: [service('Aula única', { capacity: 1 })],
    publish: true,
  });
  expect((await book(single, day, { email: 'um@example.test', confirm: null })).status).toBe(201);
  const refused = await book(single, day, { email: 'dois@example.test', confirm: null });
  expect(refused.status).toBe(422);
  expect(refused.body.errors.answers[single.bookingId]).toEqual(['unavailable']);
});
