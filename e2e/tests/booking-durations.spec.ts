import { pickDay } from '../support/calendar.ts';
import { nextWeekdays } from '../support/dates.ts';
import { expect, test } from '../support/fixtures.ts';
import { appointmentsOf, createForm, service } from '../support/forms.ts';
import {
  bookingBar,
  firstWeekdayOfNextMonth,
  monthLabel,
  PublicForm,
  uniqueEmail,
} from '../support/public-form.ts';

const piano = () =>
  service('Piano', {
    duration: 60,
    price: 40,
    currency: 'EUR',
    extra_durations: [{ duration: 90, price: 55 }],
    monthly: { price: 120, duration: 45 },
    times: ['09:00', '11:00'],
  });

const money = (amount: number) => new RegExp(`^${amount},00\\s*€$`);

test('several durations: each time offers its lengths and prices, the review comes last and Alterar goes back', async ({ page }) => {
  const form = await createForm({ emails: [{ label: 'E-mail', required: true }], services: [piano()], publish: true });
  const view = new PublicForm(page, form);
  const [first, second] = nextWeekdays(2, 3);
  await view.open();

  const single = page.getByRole('radio', { name: /Sessões avulsas/ });
  await expect(single).toContainText('desde');
  await expect(single).toContainText('40,00');
  await expect(single).toContainText('Duração e preço em cada horário');
  await expect(page.getByRole('radio', { name: /Reserva fixa mensal/ })).toContainText('45 min');

  const hour = page.getByRole('button', { name: /^11:00\s*1 h · 40/ });
  const long = page.getByRole('button', { name: /^11:00\s*1 h 30 min · 55/ });
  const bar = bookingBar(page);

  await pickDay(page, first);
  await expect(hour).toBeVisible();
  await expect(long).toBeVisible();
  await hour.click();
  await expect(hour).toHaveAttribute('aria-pressed', 'true');
  await expect(long).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText(/Sessão guardada: .* às 11:00 · 1 h · 40,00/)).toBeVisible();
  await expect(bar.getByText(money(40))).toBeVisible();

  await pickDay(page, second);
  await long.click();
  await expect(page.getByText(/Sessão guardada: .* às 11:00 · 1 h 30 min · 55,00/)).toBeVisible();
  await expect(bar.getByText('Sessão · 2 sessões')).toBeVisible();
  await expect(bar.getByText(money(95))).toBeVisible();

  await pickDay(page, first);
  await expect(page.getByText(/Esta sessão está guardada\. Toque de novo em 11:00 · 1 h para a tirar/)).toBeVisible();
  await expect(hour).toHaveAttribute('aria-pressed', 'true');
  await hour.click();
  await expect(page.getByText(/Sessão de .* às 11:00 removida/)).toBeVisible();
  await expect(bar.getByText(money(55))).toBeVisible();
  await hour.click();
  await expect(bar.getByText(money(95))).toBeVisible();

  await view.nameBox().fill('Ana Teste');
  await view.emailBox().fill(uniqueEmail('piano'));
  const review = page.getByRole('group', { name: 'A sua marcação' });
  await expect(review).toContainText('Piano · Sessões avulsas');
  await expect(review.getByText(/11:00–12:00 · 1 h/)).toBeVisible();
  await expect(review.getByText(/11:00–12:30 · 1 h 30 min/)).toBeVisible();
  await expect(review.getByText(money(40))).toBeVisible();
  await expect(review.getByText(money(55))).toBeVisible();

  await review.getByRole('button', { name: 'Alterar' }).click();
  await expect(page.getByRole('button', { name: 'Mês seguinte' })).toBeInViewport();

  await view.submit();
  await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toBeVisible();
  await expect(view.receipt().getByText(/ · 1 h$/)).toBeVisible();
  await expect(view.receipt().getByText(/ · 1 h 30 min$/)).toBeVisible();
  await expect(view.receipt().getByText(money(95))).toBeVisible();
  expect(await appointmentsOf(form.id)).toHaveLength(2);
});

test('a time next to a long booking only offers the lengths that still fit', async ({ page }) => {
  const form = await createForm({ services: [piano()], name: false, publish: true });
  const view = new PublicForm(page, form);
  const [day] = nextWeekdays(1, 3);
  await view.open();

  await pickDay(page, day);
  await page.getByRole('button', { name: /^09:00\s*1 h 30 min · 55/ }).click();
  await view.submit();
  await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toBeVisible();

  await page.goto(`/f/${form.publicId}`);
  await pickDay(page, day);
  await expect(page.getByRole('button', { name: /^09:00/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^11:00\s*1 h · 40/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^11:00\s*1 h 30 min · 55/ })).toBeVisible();
});

test('the monthly booking has its own duration and price, and the review says so', async ({ page }) => {
  const form = await createForm({ emails: [{ label: 'E-mail', required: true }], services: [piano()], publish: true });
  const view = new PublicForm(page, form);
  await view.open();

  await page.getByRole('radio', { name: /Reserva fixa mensal/ }).click();
  await page.getByRole('button', { name: monthLabel(firstWeekdayOfNextMonth()), exact: true }).click();
  await page.getByRole('button', { name: 'Seg', exact: true }).click();
  await page.getByRole('button', { name: '09:00', exact: true }).click();

  await expect(page.getByText(/^[45] sessões de 45 min neste mês$/)).toBeVisible();
  await expect(bookingBar(page).getByText(money(120))).toBeVisible();

  await view.nameBox().fill('Ana Teste');
  await view.emailBox().fill(uniqueEmail('mensal'));
  const review = page.getByRole('group', { name: 'A sua marcação' });
  await expect(review).toContainText('Piano · Reserva fixa mensal');
  await expect(review).toContainText('45 min');

  await view.submit();
  await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toBeVisible();
  await expect(view.receipt().getByText(money(120))).toBeVisible();
  const rows = await appointmentsOf(form.id);
  expect(rows.length).toBeGreaterThanOrEqual(4);
});
