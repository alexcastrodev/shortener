import type { Page } from '@playwright/test';
import { pickDay } from '../support/calendar.ts';
import { nextWeekdays } from '../support/dates.ts';
import { expect, test } from '../support/fixtures.ts';
import { appointmentsOf, createForm, service, type FormOptions } from '../support/forms.ts';
import { firstWeekdayOfNextMonth, monthLabel, PublicForm, shortDate } from '../support/public-form.ts';

async function open(page: Page, options: FormOptions) {
  const form = await createForm({ name: false, publish: true, ...options });
  const view = new PublicForm(page, form);
  await view.open();
  return { form, view };
}

async function choose(page: Page, iso: string, time: string) {
  await pickDay(page, iso);
  await page.getByRole('button', { name: time, exact: true }).click();
}

test('the bar starts empty and a priced service starts the total at zero', async ({ page }) => {
  await open(page, { services: [service('Sessão', { price: 10, currency: 'EUR' })] });

  await expect(page.getByText('Nenhum horário escolhido')).toBeVisible();
  await expect(page.getByText('Escolha um dia e uma hora para continuar')).toBeVisible();
  await expect(page.getByText('Total', { exact: true })).toBeVisible();
  await expect(page.getByText(/^0,00\s*€$/)).toBeVisible();
});

test('a service without a price shows no total', async ({ page }) => {
  await open(page, { services: [service('Sessão')] });

  await expect(page.getByText('Nenhum horário escolhido')).toBeVisible();
  await expect(page.getByText('Total', { exact: true })).toHaveCount(0);
});

test('the bar lists the chosen days and the total follows a take 2 pay 1 bundle', async ({ page }) => {
  await open(page, { services: [service('Sessão', { price: 10, currency: 'EUR', bundle: { take: 2, pay: 1 } })] });
  const [first, second, third] = nextWeekdays(3, 3);

  await choose(page, first, '09:00');
  await expect(page.getByText(`${shortDate(first)} · 09:00`)).toBeVisible();
  await expect(page.getByText('Sessão · 1 sessão')).toBeVisible();
  await expect(page.getByText(/^10,00\s*€$/)).toBeVisible();

  await choose(page, second, '10:00');
  await expect(page.getByText('Sessão · 2 sessões')).toBeVisible();
  await expect(page.getByText(/^10,00\s*€$/)).toBeVisible();

  await choose(page, third, '09:00');
  await expect(page.getByText('Sessão · 3 sessões')).toBeVisible();
  await expect(page.getByText(/^20,00\s*€$/)).toBeVisible();

  await page.getByRole('button', { name: '09:00', exact: true }).click();
  await expect(page.getByText('Sessão · 2 sessões')).toBeVisible();
  await expect(page.getByText(/^10,00\s*€$/)).toBeVisible();
});

test('a monthly booking shows the month, the number of sessions and the monthly price', async ({ page }) => {
  await open(page, { services: [service('Sessão', { price: 120, currency: 'EUR', monthly: { price: 200 } })] });

  await expect(page.getByText('Escolha o horário para continuar')).toBeVisible();
  await page.getByRole('radio', { name: /Reserva fixa mensal/ }).click();
  await page.getByRole('button', { name: monthLabel(firstWeekdayOfNextMonth()), exact: true }).click();
  await page.getByRole('button', { name: 'Seg', exact: true }).click();

  await expect(page.getByText(/^Reserva mensal · [45] sessões$/)).toBeVisible();
  await expect(page.getByText(/^200,00\s*€$/)).toBeVisible();
});

test('sending without a time says why and sends nothing', async ({ page }) => {
  const { form } = await open(page, { services: [service('Sessão')], bookingRequired: true });
  const send = page.getByRole('button', { name: 'Enviar', exact: true });

  await expect(send).toHaveAttribute('aria-disabled', 'true');
  await send.click({ force: true });
  await expect(page.getByRole('alert').filter({ hasText: 'Escolha pelo menos um dia e uma hora.' })).toBeVisible();
  expect(await appointmentsOf(form.id)).toHaveLength(0);

  await choose(page, nextWeekdays(1, 3)[0], '09:00');
  await expect(send).toHaveAttribute('aria-disabled', 'false');
});

test('the bar stays at the bottom of the screen while the page is scrolled', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await open(page, { services: [service('Sessão')] });
  await pickDay(page, nextWeekdays(1, 3)[0]);

  const send = page.getByRole('button', { name: 'Enviar', exact: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  const box = (await send.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(640);
  expect(box.y).toBeGreaterThan(640 - 140);
  await expect(page.getByText('Nenhum horário escolhido')).toBeInViewport();
});

test('after booking the receipt shows the status, the service, the sessions and the total', async ({ page }) => {
  const { form, view } = await open(page, { name: true, services: [service('Corte', { price: 15, currency: 'EUR' })] });
  const [day] = nextWeekdays(1, 3);

  await view.nameBox().fill('Ana Teste');
  await choose(page, day, '09:00');
  await view.submit();

  await expect(page.getByRole('heading', { name: 'Obrigado' })).toBeVisible();
  const receipt = view.receipt();
  await expect(receipt.getByText('Confirmada', { exact: true })).toBeVisible();
  await expect(receipt.getByText('Corte', { exact: true })).toBeVisible();
  await expect(receipt.getByText(/15,00\s*€/)).toBeVisible();
  await expect(receipt.getByText(/09:00/)).toBeVisible();
  expect(await appointmentsOf(form.id)).toHaveLength(1);
});
