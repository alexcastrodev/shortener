import { openAgendaDay } from '../support/client-account.ts';
import { nextWeekdays } from '../support/dates.ts';
import { expect, test } from '../support/fixtures.ts';
import { createForm, service, uniqueTitle } from '../support/forms.ts';
import { bookViaApi, uniqueEmail } from '../support/public-form.ts';

const [day] = nextWeekdays(1, 56);

test('a session with clients shows a user icon and how many, and an empty one shows nothing', async ({ page, signIn }) => {
  const name = uniqueTitle('Aula');
  const form = await createForm({
    name: true,
    emails: [{ label: 'E-mail' }],
    services: [service(name, { capacity: 3 })],
    publish: true,
  });
  await bookViaApi(form, day, '09:00', uniqueEmail('um'));
  await bookViaApi(form, day, '09:00', uniqueEmail('dois'));

  await signIn('owner');
  await openAgendaDay(page, day);

  const full = page.getByRole('button', { name: new RegExp(`${name}.*09:00`) });
  await expect(full).toBeVisible();
  await expect(full.getByTitle('2 clientes')).toBeVisible();
  await expect(full.getByTitle('2 clientes')).toContainText('2');
  await expect(full).toContainText('2/3');

  const empty = page.getByRole('button', { name: new RegExp(`${name}.*10:00`) });
  await expect(empty).toBeVisible();
  await expect(empty).toContainText('Livre');
  await expect(empty.getByTitle(/cliente/)).toHaveCount(0);

  await bookViaApi(form, day, '10:00', uniqueEmail('tres'));
  await openAgendaDay(page, day);
  await expect(page.getByRole('button', { name: new RegExp(`${name}.*10:00`) }).getByTitle('1 cliente')).toBeVisible();
});
