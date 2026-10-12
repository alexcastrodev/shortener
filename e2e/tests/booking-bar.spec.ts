import type { Page } from '@playwright/test';
import { pickDay } from '../support/calendar.ts';
import { nextMonthWeek, nextWeekdays } from '../support/dates.ts';
import { expect, test } from '../support/fixtures.ts';
import { appointmentsOf, createForm, service, type FormOptions } from '../support/forms.ts';
import { bookingBar, firstWeekdayOfNextMonth, monthLabel, PublicForm, shortDate } from '../support/public-form.ts';

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

test('the bar lists the chosen days and the total follows the number of sessions', async ({ page }) => {
  await open(page, { services: [service('Sessão', { price: 10, currency: 'EUR' })] });
  const [first, second, third] = nextWeekdays(3, 3);

  await choose(page, first, '09:00');
  await expect(bookingBar(page).getByText(`${shortDate(first)} · 09:00`)).toBeVisible();
  await expect(page.getByText('Sessão · 1 sessão')).toBeVisible();
  await expect(page.getByText(/^10,00\s*€$/)).toBeVisible();

  await choose(page, second, '10:00');
  await expect(page.getByText('Sessão · 2 sessões')).toBeVisible();
  await expect(page.getByText(/^20,00\s*€$/)).toBeVisible();

  await choose(page, third, '09:00');
  await expect(page.getByText('Sessão · 3 sessões')).toBeVisible();
  await expect(page.getByText(/^30,00\s*€$/)).toBeVisible();

  await page.getByRole('button', { name: '09:00', exact: true }).click();
  await expect(page.getByText('Sessão · 2 sessões')).toBeVisible();
  await expect(page.getByText(/^20,00\s*€$/)).toBeVisible();
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

const summaryOf = (page: Page) => bookingBar(page).locator('p').first();

const cut = (page: Page) =>
  summaryOf(page).evaluate(element => element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1);

const lines = (page: Page) =>
  summaryOf(page).evaluate(element => Math.round(element.clientHeight / parseFloat(getComputedStyle(element).lineHeight)));

async function expectBarWhole(page: Page, width: number) {
  const bar = bookingBar(page);
  expect((await bar.boundingBox())!.height).toBeLessThan(90);
  await expect(bar.getByText('Total', { exact: true })).toBeInViewport({ ratio: 1 });
  await expect(bar.getByRole('button', { name: 'Enviar', exact: true })).toBeInViewport({ ratio: 1 });
  const send = (await bar.getByRole('button', { name: 'Enviar', exact: true }).boundingBox())!;
  expect(send.x + send.width).toBeLessThanOrEqual(width);
}

for (const width of [390, 320]) {
  test(`at ${width}px the month and the sessions of a plan wrap on the bar instead of being cut`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const { view } = await open(page, {
      services: [service('Massagem', { price: 40, currency: 'EUR', times: ['09:00', '10:00'], monthly: { price: 150, sessions: 5 } })],
    });
    const [mon, tue, wed] = nextMonthWeek();
    await page.getByRole('radio', { name: /Reserva fixa mensal/ }).click();
    await page.getByRole('button', { name: monthLabel(mon), exact: true }).click();
    await view.pickPlanSlot(mon, '09:00');
    await view.pickPlanSlot(tue, '10:00');
    await view.pickPlanSlot(wed, '09:00');

    await expect(summaryOf(page)).toHaveText(/^[a-zç]+ · 3 sessões$/);
    expect(await cut(page)).toBe(false);
    expect(await lines(page)).toBeLessThanOrEqual(2);
    await expectBarWhole(page, width);
  });
}

test('at 390px the services of a booking fit on two lines of the bar and at 320px they stop at two', async ({ page }) => {
  const names = ['Guitarra', 'Bateria', 'Piano clássico'];
  const { view } = await open(page, {
    rules: { multiple_services: true },
    services: names.map(name => service(name, { price: 40, currency: 'EUR', times: ['09:00'] })),
  });
  const days = nextWeekdays(3, 3);
  for (const name of names) await view.tickService(name);
  for (const [index, name] of names.entries()) await view.pickSlotIn(name, days[index], '09:00');

  await page.setViewportSize({ width: 390, height: 800 });
  await expect(summaryOf(page)).toHaveText('Guitarra, Bateria, Piano clássico');
  expect(await cut(page)).toBe(false);
  expect(await lines(page)).toBe(2);
  await expectBarWhole(page, 390);

  await page.setViewportSize({ width: 320, height: 800 });
  expect(await lines(page)).toBe(2);
  await expectBarWhole(page, 320);
});
