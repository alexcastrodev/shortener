import { anonymous } from '../support/api.ts';
import { nextWeekdays } from '../support/dates.ts';
import { accounts } from '../support/auth.ts';
import { createForm, service } from '../support/forms.ts';
import { expect, test } from '../support/fixtures.ts';
import { linkTo, waitForMail } from '../support/mail.ts';

test('a booking sends the client a confirmation with a working manage link', async ({ page }) => {
  const form = await createForm({ emails: [{ label: 'E-mail' }], services: [service('Massagem')], publish: true });
  const [date] = nextWeekdays(1);
  const booked = await anonymous.post(`/api/public/forms/${form.publicId}/responses`, {
    answers: {
      [form.nameId!]: 'Cliente Mail',
      [form.emailIds[0]]: accounts.client,
      [form.bookingId]: { service: form.serviceIds[0], sessions: [{ date, time: '09:00' }] },
    },
    confirm_field_id: form.emailIds[0],
    client_time_zone: 'Europe/Lisbon',
    client_locale: 'pt-PT',
  });
  expect(booked.status).toBe(201);

  const mail = await waitForMail(accounts.client);
  expect(mail.text).toContain('Massagem');
  await page.goto(linkTo(mail, 'm'));
  await expect(page.getByRole('heading', { name: 'A sua marcação' })).toBeVisible();
});
