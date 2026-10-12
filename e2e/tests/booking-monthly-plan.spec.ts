import type { Page } from '@playwright/test';
import { dayLabel, pickDay, pickLockedDay } from '../support/calendar.ts';
import { nextMonthWeek } from '../support/dates.ts';
import { BookingEditor, bookingOf } from '../support/editor.ts';
import { expect, test } from '../support/fixtures.ts';
import { appointmentsOf, createForm, ownerForm, service } from '../support/forms.ts';
import { bookingBar, bookViaApi, monthLabel, PublicForm, uniqueEmail } from '../support/public-form.ts';

const times = ['09:00', '10:00', '11:00'];

const massage = (monthly: { sessions?: number; per?: 'month' | 'week' }) =>
  service('Massagem', {
    duration: 60,
    price: 40,
    currency: 'EUR',
    times,
    monthly: { price: 150, ...monthly },
  });

const money = (amount: number) => new RegExp(`^${amount},00\\s*€$`);

async function openPlan(page: Page, month: string) {
  await page.getByRole('radio', { name: /Reserva fixa mensal/ }).click();
  await page.getByRole('button', { name: monthLabel(month), exact: true }).click();
}

test('the owner gives the monthly offer an allowance, saves it, and reads it back after a reload', async ({ page, signIn }) => {
  const form = await createForm({
    services: [service('Massagem', { duration: 60, price: 40, currency: 'EUR', times, monthly: { price: 150 } })],
  });
  await signIn('owner');
  const editor = new BookingEditor(page);
  const saved = async () => bookingOf(await ownerForm(form.id)).services[0].monthly;
  await editor.open(form.id);

  const sessions = editor.services.getByRole('textbox', { name: 'Sessões incluídas (opcional)' });
  await expect(editor.services.getByText('por semana', { exact: true })).toHaveCount(0);
  await sessions.fill('5');
  await expect(editor.services.getByText(/Mensal .*· 5 por mês/)).toBeVisible();

  await editor.save();
  await expect(editor.saved).toBeVisible();
  await expect.poll(saved).toEqual({ price: 150, sessions: 5 });

  await editor.open(form.id);
  await expect(sessions).toHaveValue('5');
  await expect(editor.services.getByText(/Mensal .*· 5 por mês/)).toBeVisible();

  await editor.services.getByText('por semana', { exact: true }).click();
  await sessions.fill('1');
  await expect(editor.services.getByText(/Mensal .*· 1 por semana/)).toBeVisible();
  await editor.save();
  await expect.poll(saved).toEqual({ price: 150, sessions: 1, per: 'week' });

  await sessions.fill('');
  await editor.save();
  await expect.poll(saved).toEqual({ price: 150 });
});

test('a number out of range is refused in the editor and nothing is saved', async ({ page, signIn }) => {
  const form = await createForm({
    services: [massage({ sessions: 3 })],
  });
  await signIn('owner');
  const editor = new BookingEditor(page);
  await editor.open(form.id);

  await editor.services.getByRole('textbox', { name: 'Sessões incluídas (opcional)' }).fill('20');
  await editor.services.getByRole('textbox', { name: /^Preço mensal/ }).click();
  await editor.services.getByText('por semana', { exact: true }).click();
  await editor.save();
  await expect(editor.services.getByText('Por semana, indique um número inteiro de 1 a 7')).toBeVisible();
  expect(bookingOf(await ownerForm(form.id)).services[0].monthly).toEqual({ price: 150, sessions: 3 });
});

test('a visitor picks the days of a plan, each with its own time, and pays the plan once', async ({ page, signIn }) => {
  const form = await createForm({
    emails: [{ label: 'E-mail', required: true }],
    services: [massage({ sessions: 5 })],
    publish: true,
  });
  const [mon, tue, wed, thu, fri, nextMon] = nextMonthWeek();
  const view = new PublicForm(page, form);
  const bar = bookingBar(page);
  await view.open();
  await openPlan(page, mon);

  await expect(page.getByText('0 de 5 sessões incluídas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mês seguinte' })).toHaveCount(0);

  await view.pickPlanSlot(mon, '09:00');
  await view.pickPlanSlot(tue, '10:00');
  await view.pickPlanSlot(wed, '11:00');
  await expect(page.getByText('3 de 5 sessões incluídas').first()).toBeVisible();
  await expect(bar.getByText(/^[a-zç]+ · 3 sessões$/)).toBeVisible();
  await expect(bar.getByText('3 de 5 sessões incluídas')).toBeVisible();
  await expect(bar.getByText(money(150))).toBeVisible();

  await view.pickPlanSlot(thu, '09:00');
  await view.pickPlanSlot(fri, '10:00');
  await expect(page.getByText('5 de 5 sessões incluídas').first()).toBeVisible();

  await view.pickPlanSlot(nextMon, '09:00');
  await expect(
    page.getByText('Já escolheu as 5 sessões incluídas no plano. Toque numa para a trocar.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '09:00', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('5 de 5 sessões incluídas').first()).toBeVisible();
  await expect(bar.getByText(money(150))).toBeVisible();

  await view.pickPlanSlot(fri, '10:00');
  await expect(page.getByText('4 de 5 sessões incluídas').first()).toBeVisible();
  await view.pickPlanSlot(thu, '09:00');
  await expect(page.getByText('3 de 5 sessões incluídas').first()).toBeVisible();
  await expect(bar.getByText(money(150))).toBeVisible();

  await view.nameBox().fill('Ana Teste');
  await view.emailBox().fill(uniqueEmail('plano'));
  const review = page.getByRole('group', { name: 'A sua marcação' });
  await expect(review).toContainText('Massagem · Reserva fixa mensal');
  await expect(review).toContainText('09:00–10:00');
  await expect(review).toContainText('10:00–11:00');
  await expect(review).toContainText('11:00–12:00');
  await expect(review).toContainText('3 de 5 sessões incluídas');

  await view.submit();
  await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toBeVisible();
  const receipt = page.getByRole('region', { name: 'A sua marcação' });
  await expect(receipt.getByRole('listitem')).toHaveCount(3);
  await expect(receipt.getByText(/09:00/)).toBeVisible();
  await expect(receipt.getByText(/10:00/)).toBeVisible();
  await expect(receipt.getByText(/11:00/)).toBeVisible();
  await expect(receipt.getByText(money(150))).toBeVisible();

  const rows = await appointmentsOf(form.id);
  expect(rows).toHaveLength(3);
  expect(new Set(rows.map(row => row.group_key)).size).toBe(1);

  await page.goto(`/m/${await view.manageToken()}`);
  await expect(page.getByRole('button', { name: 'Cancelar só esta' })).toHaveCount(3);
  await expect(page.getByText(/09:00/)).toBeVisible();
  await expect(page.getByText(/10:00/)).toBeVisible();
  await expect(page.getByText(/11:00/)).toBeVisible();

  await signIn('owner');
  await page.goto(`/app/forms/${form.id}/responses`);
  await page.getByRole('tab', { name: /^Respostas/ }).click();
  await page.getByRole('row').filter({ hasText: 'Ana Teste' }).click();
  await expect(page.getByRole('dialog').getByText(`${mon} 09:00, ${tue} 10:00, ${wed} 11:00`)).toBeVisible();
});

test('a plan of one session a week refuses a second pick in the same week and takes the next week', async ({ page }) => {
  const form = await createForm({ services: [massage({ sessions: 1, per: 'week' })], publish: true });
  const [mon, , wed, , , nextMon] = nextMonthWeek();
  const view = new PublicForm(page, form);
  await view.open();
  await openPlan(page, mon);

  await expect(page.getByText('0 sessões escolhidas · 1 por semana')).toBeVisible();
  await view.pickPlanSlot(mon, '09:00');
  await expect(page.getByText('1 sessão escolhida · 1 por semana').first()).toBeVisible();

  await view.pickPlanSlot(wed, '10:00');
  await expect(page.getByText('O plano inclui 1 sessão por semana; já tem uma nessa semana.')).toBeVisible();
  await expect(page.getByRole('button', { name: '10:00', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('1 sessão escolhida · 1 por semana').first()).toBeVisible();

  await view.pickPlanSlot(nextMon, '10:00');
  await expect(page.getByText('2 sessões escolhidas · 1 por semana').first()).toBeVisible();
  await expect(bookingBar(page).getByText(money(150))).toBeVisible();
});

test('switching the month clears the days of the plan', async ({ page }) => {
  const form = await createForm({ services: [massage({ sessions: 3 })], publish: true });
  const [mon] = nextMonthWeek();
  const view = new PublicForm(page, form);
  const bar = bookingBar(page);
  await view.open();
  await openPlan(page, mon);

  await view.pickPlanSlot(mon, '09:00');
  await expect(bar.getByText('1 de 3 sessões incluídas')).toBeVisible();

  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
  await page.getByRole('button', { name: monthLabel(thisMonth), exact: true }).click();
  await expect(page.getByText('0 de 3 sessões incluídas')).toBeVisible();
  await expect(bar.getByText('Nenhum horário escolhido')).toBeVisible();
});

test('a monthly offer without an allowance still asks for weekdays and one time', async ({ page }) => {
  const form = await createForm({
    services: [service('Massagem', { duration: 60, price: 40, currency: 'EUR', times, monthly: { price: 150 } })],
    publish: true,
  });
  const [mon] = nextMonthWeek();
  const view = new PublicForm(page, form);
  await view.open();
  await openPlan(page, mon);

  await expect(page.getByText('Dias da semana', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Seg', exact: true })).toBeVisible();
  await expect(page.getByText(/sessões incluídas/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mês seguinte' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Seg', exact: true }).click();
  await expect(page.getByText(/^[45] sessões de 1 h neste mês$/)).toBeVisible();
  await expect(bookingBar(page).getByText(money(150))).toBeVisible();
});

test('a plan of one service and single sessions of another are booked together for the sum', async ({ page }) => {
  const form = await createForm({
    emails: [{ label: 'E-mail', required: true }],
    rules: { multiple_services: true },
    services: [
      massage({ sessions: 3 }),
      service('Guitarra', { duration: 60, price: 40, currency: 'EUR', times }),
    ],
    publish: true,
  });
  const [mon, tue] = nextMonthWeek();
  const view = new PublicForm(page, form);
  const bar = bookingBar(page);
  await view.open();
  await view.tickService('Massagem');
  await view.tickService('Guitarra');

  const plan = view.block('Massagem');
  await plan.getByRole('radio', { name: /Reserva fixa mensal/ }).click();
  await plan.getByRole('button', { name: monthLabel(mon), exact: true }).click();
  await view.pickPlanSlot(mon, '09:00', plan);
  await view.pickPlanSlot(tue, '10:00', plan);
  await expect(plan.getByText('2 de 3 sessões incluídas').first()).toBeVisible();

  const guitar = view.block('Guitarra');
  await view.pickSlotIn('Guitarra', mon, '09:00');
  await expect(guitar.getByText(/Essa hora sobrepõe-se à sua sessão de Massagem das 09:00/)).toBeVisible();

  await guitar.getByRole('button', { name: '10:00', exact: true }).click();
  await expect(guitar.getByText(/Sessão guardada: .* às 10:00/)).toBeVisible();
  await expect(bar.getByText('Massagem, Guitarra')).toBeVisible();
  await expect(bar.getByText(money(190))).toBeVisible();

  await view.nameBox().fill('Ana Teste');
  await view.emailBox().fill(uniqueEmail('plano-multiplo'));
  await view.submit();
  await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'A sua marcação' }).getByText(money(190))).toBeVisible();

  const rows = await appointmentsOf(form.id);
  expect(rows.filter(row => row.service_name === 'Massagem')).toHaveLength(2);
  expect(rows.filter(row => row.service_name === 'Guitarra')).toHaveLength(1);
  expect(new Set(rows.map(row => row.group_key)).size).toBe(1);
});

test('a plan with its own duration only offers the times where that duration fits', async ({ page }) => {
  const form = await createForm({
    services: [
      service('Massagem', { duration: 60, price: 40, currency: 'EUR', times, monthly: { price: 150, sessions: 3, duration: 90 } }),
    ],
    publish: true,
  });
  const [mon, tue] = nextMonthWeek();
  await bookViaApi(form, mon, '10:00');
  const view = new PublicForm(page, form);
  const time = (value: string) => page.getByRole('button', { name: value, exact: true });
  await view.open();

  await pickDay(page, mon);
  await expect(time('09:00')).toBeVisible();
  await expect(time('11:00')).toBeVisible();
  await expect(time('10:00')).toHaveCount(0);

  await openPlan(page, mon);
  await pickLockedDay(page, mon);
  await expect(time('11:00')).toBeVisible();
  await expect(time('09:00')).toHaveCount(0);
  await expect(time('10:00')).toHaveCount(0);

  await pickLockedDay(page, tue);
  await expect(time('09:00')).toBeVisible();
  await expect(time('10:00')).toBeVisible();
  await expect(time('11:00')).toBeVisible();

  await view.pickPlanSlot(mon, '11:00');
  await view.pickPlanSlot(tue, '09:00');
  await view.nameBox().fill('Ana Teste');
  const review = page.getByRole('group', { name: 'A sua marcação' });
  await expect(review).toContainText('11:00–12:30');
  await expect(review).toContainText('09:00–10:30');
  await view.submit();
  await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toBeVisible();
  expect(await appointmentsOf(form.id)).toHaveLength(3);
});

test('switching between single sessions and the plan keeps the month being looked at and the times already loaded', async ({ page }) => {
  const form = await createForm({ services: [massage({ sessions: 3 })], publish: true });
  const [mon] = nextMonthWeek();
  const asked: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/slots')) asked.push(url.searchParams.has('monthly') ? 'plan' : 'days');
  });
  const count = (kind: string) => asked.filter(item => item === kind).length;
  const day = page.getByRole('button', { name: new RegExp(`^${dayLabel(mon)}`) });
  const view = new PublicForm(page, form);
  await view.open();

  await pickDay(page, mon);
  await expect(page.getByText(monthLabel(mon), { exact: true })).toBeVisible();
  const days = count('days');

  await openPlan(page, mon);
  await pickLockedDay(page, mon);
  const plan = count('plan');
  expect(plan).toBeGreaterThan(0);

  await page.getByRole('radio', { name: /Sessões avulsas/ }).click();
  await expect(page.getByText(monthLabel(mon), { exact: true })).toBeVisible();
  await expect(day).toBeEnabled();
  expect(count('days')).toBe(days);

  await page.getByRole('radio', { name: /Reserva fixa mensal/ }).click();
  await expect(page.getByRole('button', { name: monthLabel(mon), exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(day).toBeEnabled();
  expect(count('plan')).toBe(plan);
});
