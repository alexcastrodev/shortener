import { pickDay } from '../support/calendar.ts';
import { nextMonthWeek, nextWeekdays } from '../support/dates.ts';
import { expect, test } from '../support/fixtures.ts';
import { appointmentsOf, createForm, service } from '../support/forms.ts';
import {
  bookingBar,
  bookViaApi,
  firstWeekdayOfNextMonth,
  monthLabel,
  PublicForm,
  uniqueEmail,
} from '../support/public-form.ts';

const times = ['09:00', '10:00', '11:00'];

const guitar = () =>
  service('Guitarra', { duration: 60, price: 40, currency: 'EUR', times, monthly: { price: 300 } });
const drums = () =>
  service('Bateria', { duration: 60, price: 50, currency: 'EUR', times, monthly: { price: 350 } });

const money = (amount: number) => new RegExp(`^${amount},00\\s*€$`);

test('without the rule the services stay a radio list with one calendar', async ({ page }) => {
  const form = await createForm({ services: [guitar(), drums()], publish: true });
  const view = new PublicForm(page, form);
  await view.open();

  await expect(page.getByRole('radio', { name: /^Guitarra/ })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /^Guitarra/ })).toHaveCount(0);

  await view.chooseService('Guitarra');
  await view.chooseService('Bateria');
  await expect(page.getByRole('radio', { name: /^Bateria/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('region', { name: 'Guitarra', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mês seguinte' })).toHaveCount(1);
});

test('a visitor books single sessions of one service and a monthly booking of another in one go', async ({ page, signIn }) => {
  const form = await createForm({
    emails: [{ label: 'E-mail', required: true }],
    rules: { multiple_services: true },
    services: [guitar(), drums()],
    publish: true,
  });
  const view = new PublicForm(page, form);
  const [first, second] = nextWeekdays(2, 3);
  const bar = bookingBar(page);
  await view.open();

  await expect(page.getByRole('radio', { name: /^Guitarra/ })).toHaveCount(0);
  await view.tickService('Guitarra');
  await view.tickService('Bateria');
  await expect(view.block('Guitarra')).toBeVisible();
  await expect(view.block('Bateria')).toBeVisible();

  await view.pickSlotIn('Guitarra', first, '09:00');
  await view.pickSlotIn('Guitarra', second, '09:00');
  await expect(bar.getByText(money(80))).toBeVisible();

  const drumsBlock = view.block('Bateria');
  await drumsBlock.getByRole('radio', { name: /Reserva fixa mensal/ }).click();
  await drumsBlock.getByRole('button', { name: monthLabel(firstWeekdayOfNextMonth()), exact: true }).click();
  await drumsBlock.getByRole('button', { name: 'Seg', exact: true }).click();
  await drumsBlock.getByRole('button', { name: '10:00', exact: true }).click();

  await expect(bar.getByText('Guitarra, Bateria')).toBeVisible();
  await expect(bar.getByText(money(430))).toBeVisible();

  await view.nameBox().fill('Ana Teste');
  await view.emailBox().fill(uniqueEmail('multiplo'));
  const review = page.getByRole('group', { name: 'A sua marcação' });
  await expect(review).toContainText('Guitarra · Sessões avulsas');
  await expect(review).toContainText('Bateria · Reserva fixa mensal');
  await expect(review.getByText('Total', { exact: true })).toBeVisible();
  await expect(review.getByText(money(430))).toBeVisible();

  await view.submit();
  await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toBeVisible();
  const receipt = page.getByRole('region', { name: 'A sua marcação' });
  await expect(receipt.getByText('Guitarra, Bateria', { exact: true })).toBeVisible();
  await expect(receipt.getByText(/^Guitarra · .* 09:00/).first()).toBeVisible();
  await expect(receipt.getByText(/^Bateria · .* 10:00/).first()).toBeVisible();
  await expect(receipt.getByText(money(430))).toBeVisible();

  const rows = await appointmentsOf(form.id);
  expect(rows.filter(row => row.service_name === 'Guitarra')).toHaveLength(2);
  expect(rows.filter(row => row.service_name === 'Bateria').length).toBeGreaterThanOrEqual(4);
  expect(new Set(rows.map(row => row.group_key)).size).toBe(1);

  await signIn('owner');
  await page.goto(`/app/forms/${form.id}/responses`);
  await page.getByRole('tab', { name: /^Respostas/ }).click();
  await page.getByRole('row').filter({ hasText: 'Ana Teste' }).click();
  await expect(
    page
      .getByRole('dialog')
      .getByText(/Guitarra: \d{4}-\d\d-\d\d 09:00, \d{4}-\d\d-\d\d 09:00; Bateria: \d{4}-\d\d-\d\d 10:00/),
  ).toBeVisible();
});

test('the manage page names the service of each session of a booking with several', async ({ page }) => {
  const form = await createForm({
    emails: [{ label: 'E-mail', required: true }],
    rules: { multiple_services: true },
    services: [guitar(), drums()],
    publish: true,
  });
  const view = new PublicForm(page, form);
  const [day] = nextWeekdays(1, 3);
  await view.open();
  await view.tickService('Guitarra');
  await view.tickService('Bateria');
  await view.pickSlotIn('Guitarra', day, '09:00');
  await view.pickSlotIn('Bateria', day, '11:00');
  await view.nameBox().fill('Ana Teste');
  await view.emailBox().fill(uniqueEmail('gestao'));
  await view.submit();
  await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toBeVisible();

  await page.goto(`/m/${await view.manageToken()}`);
  await expect(page.getByText('Guitarra, Bateria', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Guitarra · .* 09:00/)).toBeVisible();
  await expect(page.getByText(/^Bateria · .* 11:00/)).toBeVisible();
});

test('a time that overlaps a session of another service is refused with its name, and the next one is taken', async ({ page }) => {
  const form = await createForm({ rules: { multiple_services: true }, services: [guitar(), drums()], publish: true });
  const view = new PublicForm(page, form);
  const [day] = nextWeekdays(1, 3);
  const bar = bookingBar(page);
  await view.open();
  await view.tickService('Guitarra');
  await view.tickService('Bateria');

  await view.pickSlotIn('Guitarra', day, '10:00');
  const drumsBlock = view.block('Bateria');
  await pickDay(drumsBlock, day);
  await drumsBlock.getByRole('button', { name: '10:00', exact: true }).click();
  await expect(drumsBlock.getByText(/Essa hora sobrepõe-se à sua sessão de Guitarra das 10:00/)).toBeVisible();
  await expect(drumsBlock.getByRole('button', { name: '10:00', exact: true })).toHaveAttribute('aria-pressed', 'false');

  await drumsBlock.getByRole('button', { name: '11:00', exact: true }).click();
  await expect(drumsBlock.getByText(/Sessão guardada: .* às 11:00/)).toBeVisible();
  await expect(bar.getByText('Guitarra, Bateria')).toBeVisible();
  await expect(bar.getByText(money(90))).toBeVisible();

  await page.getByRole('checkbox', { name: /^Bateria/ }).click();
  await expect(view.block('Bateria')).toHaveCount(0);
  await expect(bar.getByText(money(40))).toBeVisible();
});

test('a ticked service with no time chosen blocks the send and names the service, until it is unticked', async ({ page }) => {
  const form = await createForm({ rules: { multiple_services: true }, services: [guitar(), drums()], publish: true });
  const view = new PublicForm(page, form);
  const [day] = nextWeekdays(1, 3);
  await view.open();
  await view.tickService('Guitarra');
  await view.tickService('Bateria');
  await view.pickSlotIn('Guitarra', day, '09:00');
  await view.nameBox().fill('Ana Teste');

  await expect(bookingBar(page).getByText('Falta escolher: Bateria')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar', exact: true }).click({ force: true });
  await expect(page.getByText('Escolha dia e hora para Bateria, ou desmarque-o.')).toBeVisible();
  expect(await appointmentsOf(form.id)).toHaveLength(0);

  await page.getByRole('checkbox', { name: /^Bateria/ }).click();
  await view.submit();
  await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toBeVisible();
  expect(await appointmentsOf(form.id)).toHaveLength(1);
});

test('a time chosen for one service is kept when another service is ticked afterwards', async ({ page }) => {
  const form = await createForm({ rules: { multiple_services: true }, services: [guitar(), drums()], publish: true });
  const view = new PublicForm(page, form);
  const [day] = nextWeekdays(1, 3);
  const bar = bookingBar(page);
  await view.open();

  await view.tickService('Bateria');
  await view.pickSlotIn('Bateria', day, '10:00');
  const chosen = view.block('Bateria').getByRole('button', { name: '10:00', exact: true });
  await expect(chosen).toHaveAttribute('aria-pressed', 'true');
  await expect(bar.getByText(money(50))).toBeVisible();

  await view.tickService('Guitarra');
  await expect(chosen).toHaveAttribute('aria-pressed', 'true');
  await expect(bar.getByText(money(50))).toBeVisible();
  await expect(bar.getByText('Falta escolher: Guitarra')).toBeVisible();
  await expect(bar.getByText('Nenhum horário escolhido')).toHaveCount(0);

  await view.pickSlotIn('Guitarra', day, '11:00');
  await expect(bar.getByText(money(90))).toBeVisible();
});

test('the radio list of a form without the rule still keeps only one service', async ({ page }) => {
  const form = await createForm({ services: [guitar(), drums()], publish: true });
  const view = new PublicForm(page, form);
  const [day] = nextWeekdays(1, 3);
  await view.open();

  await view.chooseService('Bateria');
  await view.pickSlot(day, '10:00');
  await expect(bookingBar(page).getByText(money(50))).toBeVisible();

  await view.chooseService('Guitarra');
  await expect(bookingBar(page).getByText('Nenhum horário escolhido')).toBeVisible();
});

test('a time taken in the meantime is dropped from the block of its service, which says so', async ({ page }) => {
  const form = await createForm({ rules: { multiple_services: true }, services: [guitar(), drums()], publish: true });
  const view = new PublicForm(page, form);
  const [day, other] = nextWeekdays(2, 3);
  await view.open();
  await view.tickService('Guitarra');
  await view.tickService('Bateria');
  await view.pickSlotIn('Guitarra', day, '09:00');
  await view.pickSlotIn('Bateria', other, '10:00');
  await view.nameBox().fill('Ana Teste');

  await bookViaApi(form, day, '09:00');
  await view.submit();

  await expect(view.block('Guitarra').getByRole('alert')).toHaveText('A hora de Guitarra já não está disponível. Escolha outra.');
  await expect(view.block('Bateria').getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toHaveCount(0);
  expect(await appointmentsOf(form.id)).toHaveLength(1);
});

test('a refusal from the server names the service and the time it is about', async ({ page }) => {
  const form = await createForm({ rules: { multiple_services: true }, services: [guitar(), drums()], publish: true });
  const view = new PublicForm(page, form);
  const [day, other] = nextWeekdays(2, 3);
  await page.route('**/api/public/forms/*/responses', route =>
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        errors: { answers: { [form.bookingId]: ['unavailable'] } },
        details: { [form.bookingId]: { service: form.serviceIds[1], date: other, time: '10:00' } },
      }),
    }),
  );
  await view.open();
  await view.tickService('Guitarra');
  await view.tickService('Bateria');
  await view.pickSlotIn('Guitarra', day, '09:00');
  await view.pickSlotIn('Bateria', other, '10:00');
  await view.nameBox().fill('Ana Teste');
  await view.submit();

  await expect(page.getByRole('alert').filter({ hasText: /^A hora de Bateria \(.*às 10:00\) já não está disponível\. Escolha outra\.$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toHaveCount(0);
});

test('a refusal without details keeps the plain message', async ({ page }) => {
  const form = await createForm({ rules: { multiple_services: true }, services: [guitar(), drums()], publish: true });
  const view = new PublicForm(page, form);
  const [day, other] = nextWeekdays(2, 3);
  await page.route('**/api/public/forms/*/responses', route =>
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ errors: { answers: { [form.bookingId]: ['unavailable'] } } }),
    }),
  );
  await view.open();
  await view.tickService('Guitarra');
  await view.tickService('Bateria');
  await view.pickSlotIn('Guitarra', day, '09:00');
  await view.pickSlotIn('Bateria', other, '10:00');
  await view.nameBox().fill('Ana Teste');
  await view.submit();

  await expect(page.getByRole('alert').filter({ hasText: 'Esse horário acabou de ser ocupado. Escolha outro.' })).toBeVisible();
});

test('a weekday pattern that lands on a session of another service is refused in the browser with its name', async ({ page }) => {
  const form = await createForm({ rules: { multiple_services: true }, services: [guitar(), drums()], publish: true });
  const view = new PublicForm(page, form);
  const [mon] = nextMonthWeek();
  const bar = bookingBar(page);
  await view.open();
  await view.tickService('Guitarra');
  await view.tickService('Bateria');
  await view.pickSlotIn('Guitarra', mon, '09:00');

  const drumsBlock = view.block('Bateria');
  await drumsBlock.getByRole('radio', { name: /Reserva fixa mensal/ }).click();
  await drumsBlock.getByRole('button', { name: monthLabel(mon), exact: true }).click();
  await drumsBlock.getByRole('button', { name: 'Seg', exact: true }).click();
  await expect(drumsBlock.getByText(/Essa hora sobrepõe-se à sua sessão de Guitarra das 09:00/)).toBeVisible();
  await expect(drumsBlock.getByRole('button', { name: 'Seg', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(bar.getByText('Falta escolher: Bateria')).toBeVisible();

  await drumsBlock.getByRole('button', { name: '10:00', exact: true }).click();
  await drumsBlock.getByRole('button', { name: 'Seg', exact: true }).click();
  await expect(drumsBlock.getByText(/Essa hora sobrepõe-se/)).toHaveCount(0);
  await expect(drumsBlock.getByRole('button', { name: 'Seg', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(bar.getByText('Guitarra, Bateria')).toBeVisible();
  await expect(bar.getByText(money(390))).toBeVisible();
});

test('with several services the day question and the time zone are said once, and the mode question is not repeated', async ({ page }) => {
  const form = await createForm({ rules: { multiple_services: true }, services: [guitar(), drums()], publish: true });
  const view = new PublicForm(page, form);
  await view.open();
  await view.tickService('Guitarra');
  await view.tickService('Bateria');

  await expect(page.getByText('Escolha dia e hora', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('combobox', { name: 'Horas em' })).toHaveCount(1);
  const drawn = await page
    .getByText('Como quer marcar?', { exact: true })
    .evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().width > 2).length);
  expect(drawn).toBe(0);
  for (const name of ['Guitarra', 'Bateria']) {
    await expect(view.block(name).getByRole('radiogroup', { name: 'Como quer marcar?' })).toBeVisible();
    await expect(view.block(name).getByText(name, { exact: true })).toBeVisible();
  }
});
