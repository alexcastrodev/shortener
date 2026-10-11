import type { Locator, Page } from '@playwright/test';
import { dayLabel, pickDay } from '../support/calendar.ts';
import { nextWeekdays } from '../support/dates.ts';
import { expect, test } from '../support/fixtures.ts';
import { appointmentsOf, createForm, service } from '../support/forms.ts';
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

  await expect(page.getByText('Sessão guardada', { exact: true })).toBeVisible();
  await expect(page.getByText('A escolher agora', { exact: true })).toBeVisible();
  await expect(page.getByText('Com horas livres', { exact: true })).toBeVisible();
});

test('a day lists its hours and how many are free, and the chosen hour goes into the day', async ({ page }) => {
  await openBookingForm(page);
  const [day] = nextWeekdays(1, 3);

  await pickDay(page, day);
  await expect(page.getByText(/Horários disponíveis em/)).toBeVisible();
  await expect(page.getByText('2 horas livres')).toBeVisible();
  await expect(page.getByText('Pode escolher vários dias e mais do que uma hora por dia.')).toBeVisible();
  await expect(page.getByText('Escolha um dia no calendário para ver as horas.')).toBeHidden();

  await page.getByRole('button', { name: '09:00', exact: true }).click();
  const chosen = page.getByRole('button', { name: `${dayLabel(day)}, hora escolhida 09:00`, exact: true });
  await expect(chosen).toBeVisible();
  await expect(chosen).toContainText('09:00');
});

test('two hours on the same day are both kept, and an hour tapped again clears only itself', async ({ page }) => {
  await openBookingForm(page);
  const [day] = nextWeekdays(1, 3);
  const hour = (value: string) => page.getByRole('button', { name: value, exact: true });

  await pickDay(page, day);
  await hour('09:00').click();
  await expect(page.getByText(/Sessão guardada: .* às 09:00/)).toBeVisible();
  await hour('10:00').click();
  await expect(page.getByText(/Sessão guardada: .* às 10:00/)).toBeVisible();

  const both = page.getByRole('button', { name: `${dayLabel(day)}, horas escolhidas 09:00, 10:00`, exact: true });
  await expect(both).toContainText('2×');
  await expect(both).toHaveClass(/border-teal-500/);
  await expect(hour('09:00')).toHaveClass(/ring-teal-500/);
  await expect(page.locator('p', { hasText: /^Sessão guardada: / })).toHaveClass(/border-teal-500/);
  await expect(hour('09:00')).toHaveAttribute('aria-pressed', 'true');
  await expect(hour('10:00')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Sessão · 2 sessões')).toBeVisible();

  await hour('10:00').click();
  await expect(page.getByText(/Sessão de .* às 10:00 removida/)).toBeVisible();
  await expect(page.getByRole('button', { name: `${dayLabel(day)}, hora escolhida 09:00`, exact: true })).toBeVisible();
  await expect(hour('09:00')).toHaveAttribute('aria-pressed', 'true');

  await hour('09:00').click();
  await expect(page.getByRole('button', { name: /hora escolhida|horas escolhidas/ })).toHaveCount(0);
});

test('an hour that overlaps another of the same day is refused with a message, and a later one is taken', async ({ page }) => {
  const form = await createForm({
    services: [service('Aula', { duration: 90, times: ['09:00', '10:00', '11:00'] })],
    publish: true,
  });
  await new PublicForm(page, form).open();
  const [day] = nextWeekdays(1, 3);
  const hour = (value: string) => page.getByRole('button', { name: value, exact: true });

  await pickDay(page, day);
  await hour('09:00').click();
  await hour('10:00').click();
  await expect(page.getByText(/Essa hora sobrepõe-se à sua sessão das 09:00/)).toBeVisible();
  await expect(page.locator('p', { hasText: /^Essa hora sobrepõe-se/ })).toHaveClass(/border-amber-500/);
  await expect(hour('10:00')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: `${dayLabel(day)}, hora escolhida 09:00`, exact: true })).toBeVisible();

  await hour('11:00').click();
  await expect(page.getByText(/Sessão guardada: .* às 11:00/)).toBeVisible();
  await expect(page.getByRole('button', { name: `${dayLabel(day)}, horas escolhidas 09:00, 11:00`, exact: true })).toBeVisible();
});

test('two hours of one day are booked together', async ({ page }) => {
  const view = await openBookingForm(page);
  const [day] = nextWeekdays(1, 3);

  await view.pickSlot(day, '09:00');
  await page.getByRole('button', { name: '10:00', exact: true }).click();
  await view.nameBox().fill('Ana Teste');
  await view.submit();
  await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toBeVisible();

  const booked = await appointmentsOf(view.form.id);
  expect(booked).toHaveLength(2);
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
