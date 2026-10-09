import type { Locator, Page } from '@playwright/test';
import { dayLabel, pickDay } from '../support/calendar.ts';
import { nextWeekdays } from '../support/dates.ts';
import { expect, test } from '../support/fixtures.ts';
import { createForm, service } from '../support/forms.ts';
import { PublicForm } from '../support/public-form.ts';

async function openBookingForm(page: Page) {
  const form = await createForm({
    services: [service('Sessão', { price: 120, currency: 'EUR', monthly: { price: 200 } })],
    publish: true,
  });
  const view = new PublicForm(page, form);
  await view.open();
  return view;
}

test('the form opens with no day selected and asks to pick one', async ({ page }) => {
  await openBookingForm(page);

  await expect(page.getByText('Escolha um dia no calendário para ver as horas.')).toBeVisible();
  await expect(page.getByText(/Horários disponíveis em/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '09:00', exact: true })).toHaveCount(0);

  await expect(page.getByText('Com horário', { exact: true })).toBeVisible();
  await expect(page.getByText('A ver agora', { exact: true })).toBeVisible();
  await expect(page.getByText('Com horas livres', { exact: true })).toBeVisible();
});

test('a day lists its hours and how many are free, and the chosen hour goes into the day', async ({ page }) => {
  await openBookingForm(page);
  const [day] = nextWeekdays(1, 3);

  await pickDay(page, day);
  await expect(page.getByText(/Horários disponíveis em/)).toBeVisible();
  await expect(page.getByText('2 horas livres')).toBeVisible();
  await expect(page.getByText('Pode escolher vários dias, uma hora por dia.')).toBeVisible();
  await expect(page.getByText('Escolha um dia no calendário para ver as horas.')).toBeHidden();

  await page.getByRole('button', { name: '09:00', exact: true }).click();
  const chosen = page.getByRole('button', { name: `${dayLabel(day)}, hora escolhida 09:00`, exact: true });
  await expect(chosen).toBeVisible();
  await expect(chosen).toContainText('09:00');
});

test('one hour per day: another hour replaces it and the same hour clears it', async ({ page }) => {
  await openBookingForm(page);
  const [day] = nextWeekdays(1, 3);

  await pickDay(page, day);
  await page.getByRole('button', { name: '09:00', exact: true }).click();
  await page.getByRole('button', { name: '10:00', exact: true }).click();
  await expect(page.getByRole('button', { name: `${dayLabel(day)}, hora escolhida 10:00`, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: `${dayLabel(day)}, hora escolhida 09:00`, exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: '10:00', exact: true }).click();
  await expect(page.getByRole('button', { name: dayLabel(day), exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /hora escolhida/ })).toHaveCount(0);
});

test('two days keep their own hour while a third is being looked at', async ({ page }) => {
  await openBookingForm(page);
  const [first, second, third] = nextWeekdays(3, 3);

  await pickDay(page, first);
  await page.getByRole('button', { name: '09:00', exact: true }).click();
  await pickDay(page, second);
  await page.getByRole('button', { name: '10:00', exact: true }).click();
  await pickDay(page, third);

  await expect(page.getByRole('button', { name: `${dayLabel(first)}, hora escolhida 09:00`, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: `${dayLabel(second)}, hora escolhida 10:00`, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: dayLabel(third), exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('the type scale follows the design', async ({ page }) => {
  const form = await createForm({
    title: 'Marcações',
    name: false,
    emails: [{ label: 'O seu e-mail' }],
    services: [service('Sessão', { price: 120, currency: 'EUR', monthly: { price: 200 } })],
    publish: true,
  });
  await page.setViewportSize({ width: 1000, height: 900 });
  await new PublicForm(page, form).open();
  await pickDay(page, nextWeekdays(1, 3)[0]);

  const size = (locator: Locator) => locator.evaluate(element => {
    const style = getComputedStyle(element);
    return `${style.fontSize}/${style.fontWeight}`;
  });

  expect(await size(page.getByRole('heading', { name: 'Marcações', level: 1 }))).toBe('32px/600');
  expect(await size(page.getByText('Como quer marcar?', { exact: true }))).toBe('20px/600');
  expect(await size(page.getByText('Escolha dia e hora', { exact: true }))).toBe('20px/600');
  expect(await size(page.getByText('Sessões avulsas', { exact: true }))).toBe('15px/600');
  expect(await size(page.getByText(/^120,00/).first())).toBe('22px/600');
  expect(await size(page.getByRole('button', { name: '09:00', exact: true }))).toBe('15px/500');
  expect(await size(page.getByRole('button', { name: 'Enviar', exact: true }))).toBe('15px/600');
});
