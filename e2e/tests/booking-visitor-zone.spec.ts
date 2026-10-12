import type { Locator, Page } from '@playwright/test';
import { anonymous, owner } from '../support/api.ts';
import { dayLabel, pickDay } from '../support/calendar.ts';
import { isoDate, nextMonthWeek, nextWeekdays } from '../support/dates.ts';
import { expect, test } from '../support/fixtures.ts';
import { appointmentsOf, createForm, lesson, ownerForm, service, type CreatedForm } from '../support/forms.ts';
import { linkTo, waitForMail } from '../support/mail.ts';
import { stamp } from '../support/mail-booking.ts';
import { bookingBar, monthLabel, PublicForm, uniqueEmail, WAITER_EMAIL } from '../support/public-form.ts';
import { inZone, slotsOf, VIEW_ZONE_KEY } from '../support/zones.ts';

const FORM_ZONE = 'Europe/Lisbon';
const SAO_PAULO = 'America/Sao_Paulo';
const TOKYO = 'Asia/Tokyo';
const TIMES = ['17:30', '19:30', '23:30'];

const zoneSelect = (scope: Page | Locator) => scope.getByRole('combobox', { name: 'Horas em' });

const addDays = (iso: string, days: number) => {
  const [year, month, day] = iso.split('-').map(Number);
  return isoDate(new Date(year, month - 1, day + days, 12));
};

function nextWeekday(weekday: number, startOffsetDays = 2) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + startOffsetDays);
  while (date.getDay() !== weekday) date.setDate(date.getDate() + 1);
  return isoDate(date);
}

const zoneForm = (options: Parameters<typeof createForm>[0] = {}) =>
  createForm({
    emails: [{ label: 'E-mail', required: true }],
    services: [service('Consulta', { times: TIMES })],
    rules: { time_zone: FORM_ZONE },
    publish: true,
    ...options,
  });

async function fill(view: PublicForm, email = uniqueEmail()) {
  await view.nameBox().fill('Ana Teste');
  await view.emailBox().fill(email);
  return email;
}

const storedBooking = async (form: CreatedForm) => {
  const { body } = await owner.get(`/api/me/forms/${form.id}/responses`);
  return body.response[0].answers.find((answer: any) => answer.type === 'booking').value;
};

test('a visitor who changes nothing sees the times in the zone of the form', async ({ page }) => {
  const form = await zoneForm();
  const [day] = nextWeekdays(1);
  const view = new PublicForm(page, form);
  await view.open();

  await expect(zoneSelect(page)).toHaveValue(FORM_ZONE);
  await expect(zoneSelect(page).locator('option').first()).toHaveText(FORM_ZONE);
  await expect(page.getByText(/O meu fuso/)).toHaveCount(0);

  await pickDay(page, day);
  for (const time of TIMES) await expect(page.getByRole('button', { name: time, exact: true })).toBeVisible();
});

test('a visitor picks another zone, sees the times converted, books one and gets everything in that zone', async ({ page }) => {
  const form = await zoneForm();
  const [day] = nextWeekdays(1);
  const slots = await slotsOf(form, day);
  const chosen = slots.find(slot => slot.time === '19:30')!;
  const there = inZone(chosen.starts_at, SAO_PAULO);
  const view = new PublicForm(page, form);
  const bar = bookingBar(page);
  await view.open();

  await zoneSelect(page).selectOption(SAO_PAULO);
  const email = await fill(view);
  await pickDay(page, there.date);

  for (const slot of slots) {
    await expect(page.getByRole('button', { name: inZone(slot.starts_at, SAO_PAULO).time, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: '17:30', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: there.time, exact: true }).click();
  await expect(page.getByText(new RegExp(`Sessão guardada: .* às ${there.time}`))).toBeVisible();
  await expect(bar).toContainText(there.time);

  const sent = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/responses'));
  await view.submit();
  const body = (await sent).postDataJSON();
  expect(body.client_time_zone).toBe(SAO_PAULO);
  expect(body.answers[form.bookingId].sessions).toEqual([{ date: day, time: '19:30', duration: 30 }]);

  const receipt = view.receipt();
  await expect(receipt.getByText(new RegExp(`${Number(there.date.slice(8))} de .* às ${there.time}`))).toBeVisible();
  await expect(receipt.getByText(`Horas em ${SAO_PAULO}`)).toBeVisible();

  const [appointment] = await appointmentsOf(form.id);
  expect(new Date(appointment.starts_at).toISOString()).toBe(new Date(chosen.starts_at).toISOString());
  expect(await storedBooking(form)).toMatchObject({ sessions: [{ date: day, time: '19:30' }] });

  const confirmation = await waitForMail(email, 'Confirmada');
  expect(confirmation.text).toContain(stamp(there.date, there.time));

  await page.goto(linkTo(confirmation, 'm'));
  await expect(page.getByText(new RegExp(there.time))).toBeVisible();
});

test.describe('a visitor in Tokyo', () => {
  test.use({ timezoneId: TOKYO });

  test('is offered their own zone first, and a late time moves to the next day', async ({ page }) => {
    const wednesday = nextWeekday(3);
    const form = await zoneForm({ services: [service('Consulta', { days: ['wed'], times: TIMES })] });
    const slots = await slotsOf(form, wednesday);
    const late = slots.find(slot => slot.time === '23:30')!;
    const there = inZone(late.starts_at, TOKYO);
    const view = new PublicForm(page, form);
    await view.open();

    await expect(zoneSelect(page)).toHaveValue(FORM_ZONE);
    const options = zoneSelect(page).locator('option');
    await expect(options.nth(0)).toHaveText(`O meu fuso (${TOKYO})`);
    await expect(options.nth(1)).toHaveText(FORM_ZONE);

    await pickDay(page, wednesday);
    await expect(page.getByRole('button', { name: '23:30', exact: true })).toBeVisible();

    await zoneSelect(page).selectOption(TOKYO);
    const email = await fill(view);
    expect(there.date).toBe(addDays(wednesday, 1));
    await expect(page.getByRole('button', { name: new RegExp(`^${dayLabel(wednesday)}`) })).toBeDisabled();
    await expect(page.getByRole('button', { name: new RegExp(`^${dayLabel(there.date)}`) })).toBeEnabled();
    await pickDay(page, there.date);
    await expect(page.getByText(/Horários disponíveis em\s+quinta-feira/)).toBeVisible();
    for (const slot of slots) {
      await expect(page.getByRole('button', { name: inZone(slot.starts_at, TOKYO).time, exact: true })).toBeVisible();
    }

    await page.getByRole('button', { name: there.time, exact: true }).click();
    await expect(page.getByText(new RegExp(`Sessão guardada: .* às ${there.time}`))).toBeVisible();
    const sent = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/responses'));
    await view.submit();
    const body = (await sent).postDataJSON();
    expect(body.client_time_zone).toBe(TOKYO);
    expect(body.answers[form.bookingId].sessions).toEqual([{ date: wednesday, time: '23:30', duration: 30 }]);

    await expect(view.receipt().getByText(new RegExp(`quinta-feira, ${Number(there.date.slice(8))} de .* às ${there.time}`))).toBeVisible();
    const [appointment] = await appointmentsOf(form.id);
    expect(new Date(appointment.starts_at).toISOString()).toBe(new Date(late.starts_at).toISOString());
    const confirmation = await waitForMail(email, 'Confirmada');
    expect(confirmation.text).toContain(stamp(there.date, there.time));
  });

  test('who does nothing still books in the zone of the form', async ({ page }) => {
    const form = await zoneForm();
    const [day] = nextWeekdays(1);
    const view = new PublicForm(page, form);
    await view.open();
    await fill(view);
    await view.pickSlot(day, '17:30');

    const sent = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/responses'));
    await view.submit();
    const body = (await sent).postDataJSON();
    expect(body.client_time_zone).toBe(FORM_ZONE);
    expect(body.answers[form.bookingId].sessions).toEqual([{ date: day, time: '17:30', duration: 30 }]);
    await expect(view.receipt().getByText(/às 17:30/)).toBeVisible();
    await expect(view.receipt().getByText(/Horas em/)).toHaveCount(0);
  });
});

test('the chosen zone is remembered on reload and on the next form, and an unknown one is ignored', async ({ page }) => {
  const first = await zoneForm();
  const second = await zoneForm({ rules: { time_zone: 'Europe/London' } });
  const [day] = nextWeekdays(1);
  const slots = await slotsOf(first, day);
  const early = slots.find(slot => slot.time === '17:30')!;
  const view = new PublicForm(page, first);
  await view.open();

  await zoneSelect(page).selectOption(SAO_PAULO);
  expect(await page.evaluate(key => localStorage.getItem(key), VIEW_ZONE_KEY)).toBe(SAO_PAULO);

  await page.reload();
  await expect(zoneSelect(page)).toHaveValue(SAO_PAULO);
  await pickDay(page, day);
  await expect(page.getByRole('button', { name: inZone(early.starts_at, SAO_PAULO).time, exact: true })).toBeVisible();

  await page.goto(`/f/${second.publicId}`);
  await expect(zoneSelect(page)).toHaveValue(SAO_PAULO);
  await expect(zoneSelect(page).locator('option').nth(0)).toHaveText(`O meu fuso (${FORM_ZONE})`);
  await expect(zoneSelect(page).locator('option').nth(1)).toHaveText('Europe/London');

  await page.evaluate(key => localStorage.setItem(key, 'Mars/Olympus'), VIEW_ZONE_KEY);
  await page.goto(`/f/${first.publicId}`);
  await expect(zoneSelect(page)).toHaveValue(FORM_ZONE);
});

test('a weekday pattern stays in the zone of the form and says so', async ({ page }) => {
  const form = await zoneForm({
    services: [service('Massagem', { duration: 60, price: 40, currency: 'EUR', times: ['09:00'], monthly: { price: 150 } })],
  });
  const [mon] = nextMonthWeek();
  const view = new PublicForm(page, form);
  await view.open();
  await zoneSelect(page).selectOption(SAO_PAULO);

  await page.getByRole('radio', { name: /Reserva fixa mensal/ }).click();
  await page.getByRole('button', { name: monthLabel(mon), exact: true }).click();
  await expect(page.getByText(`hora do formulário: ${FORM_ZONE}`)).toBeVisible();
  await page.getByRole('button', { name: 'Seg', exact: true }).click();
  await expect(page.getByRole('button', { name: '09:00', exact: true })).toBeVisible();
  await expect(bookingBar(page)).toContainText(`09:00 (hora do formulário: ${FORM_ZONE})`);

  await page.getByRole('radio', { name: /Sessões avulsas/ }).click();
  await zoneSelect(page).selectOption(FORM_ZONE);
  await page.getByRole('radio', { name: /Reserva fixa mensal/ }).click();
  await page.getByRole('button', { name: monthLabel(mon), exact: true }).click();
  await expect(page.getByText(/hora do formulário/)).toHaveCount(0);
});

test.describe('a plan in Tokyo', () => {
  test.use({ timezoneId: TOKYO });

  test('the days of a plan are the days the visitor sees, and the plan keeps the form time', async ({ page }) => {
    const form = await zoneForm({
      services: [service('Massagem', { duration: 60, times: ['23:30'], price: 40, currency: 'EUR', monthly: { price: 150, sessions: 3 } })],
    });
    const [mon] = nextMonthWeek();
    const slots = await slotsOf(form, mon);
    const there = inZone(slots[0].starts_at, TOKYO);
    const view = new PublicForm(page, form);
    await view.open();
    await page.getByRole('radio', { name: /Reserva fixa mensal/ }).click();
    await page.getByRole('button', { name: monthLabel(mon), exact: true }).click();
    await zoneSelect(page).selectOption(TOKYO);
    await fill(view);

    await view.pickPlanSlot(there.date, there.time);
    await expect(page.getByText('1 de 3 sessões incluídas').first()).toBeVisible();
    await expect(bookingBar(page).getByText('1 de 3 sessões incluídas')).toBeVisible();
    await expect(page.getByRole('group', { name: 'A sua marcação' })).toContainText(`${there.time}–`);

    const sent = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/responses'));
    await view.submit();
    const body = (await sent).postDataJSON();
    expect(body.answers[form.bookingId].monthly.sessions).toEqual([{ date: mon, time: '23:30' }]);
    await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toBeVisible();
    const [appointment] = await appointmentsOf(form.id);
    expect(new Date(appointment.starts_at).toISOString()).toBe(new Date(slots[0].starts_at).toISOString());
  });
});

test('with several services the control is said once and every block follows it', async ({ page }) => {
  const form = await zoneForm({
    rules: { time_zone: FORM_ZONE, multiple_services: true },
    services: [service('Alfa', { times: TIMES }), service('Beta', { times: TIMES })],
  });
  const [day] = nextWeekdays(1);
  const [alfa, beta] = await Promise.all(form.serviceIds.map(id => slotsOf(form, day, day, id)));
  const view = new PublicForm(page, form);
  await view.open();
  await view.tickService('Alfa');
  await view.tickService('Beta');

  await expect(zoneSelect(page)).toHaveCount(1);
  await expect(zoneSelect(view.block('Alfa'))).toHaveCount(0);
  await zoneSelect(page).selectOption(SAO_PAULO);

  const first = inZone(alfa.find(slot => slot.time === '17:30')!.starts_at, SAO_PAULO);
  const second = inZone(beta.find(slot => slot.time === '23:30')!.starts_at, SAO_PAULO);
  await fill(view);
  await view.pickSlotIn('Alfa', first.date, first.time);
  await view.pickSlotIn('Beta', second.date, second.time);
  await view.submit();

  await expect(view.receipt().getByText(new RegExp(`Alfa · .* às ${first.time}`))).toBeVisible();
  await expect(view.receipt().getByText(new RegExp(`Beta · .* às ${second.time}`))).toBeVisible();
  const starts = (await appointmentsOf(form.id)).map(row => new Date(row.starts_at).toISOString()).sort();
  expect(starts).toEqual([alfa.find(slot => slot.time === '17:30')!.starts_at, beta.find(slot => slot.time === '23:30')!.starts_at].map(value => new Date(value).toISOString()).sort());
});

test('the owner finds the same control in the editor preview and the sample times follow it', async ({ page, signIn }) => {
  const form = await zoneForm({ emails: [], services: [service('Corte', { times: ['09:00'] })] });
  const [day] = nextWeekdays(1);
  const [slot] = await slotsOf(form, day);
  const there = inZone(slot.starts_at, TOKYO);
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);
  const screen = page.getByTestId('preview-screen');

  await expect(zoneSelect(screen)).toHaveValue(FORM_ZONE);
  await pickDay(screen, day);
  await expect(screen.getByRole('button', { name: '09:00', exact: true })).toBeVisible();

  await zoneSelect(screen).selectOption(TOKYO);
  await pickDay(screen, there.date);
  await expect(screen.getByRole('button', { name: there.time, exact: true })).toBeVisible();
  expect((await ownerForm(form.id)).fields.find((field: any) => field.type === 'booking').rules.time_zone).toBe(FORM_ZONE);
});

test('a visitor joins the waiting list with the zone they see', async ({ page }) => {
  const form = await zoneForm({
    emails: [{ label: 'E-mail' }],
    services: [service('Consulta', { times: ['09:00'] })],
    rules: { time_zone: FORM_ZONE, waitlist: true, waitlist_confirm_minutes: 120 },
  });
  const [day] = nextWeekdays(1);
  const [slot] = await slotsOf(form, day);
  const there = inZone(slot.starts_at, SAO_PAULO);
  const booked = await anonymous.post(`/api/public/forms/${form.publicId}/responses`, {
    answers: {
      [form.nameId!]: 'Ocupante',
      [form.emailIds[0]]: uniqueEmail('ocupante'),
      [form.bookingId]: { service: form.serviceIds[0], sessions: [{ date: day, time: '09:00' }] },
    },
    client_time_zone: FORM_ZONE,
    client_locale: 'pt-PT',
  });
  expect(booked.status).toBe(201);

  const view = new PublicForm(page, form);
  await view.open();
  await zoneSelect(page).selectOption(SAO_PAULO);
  await expect(page.getByText('O seu horário está cheio?')).toBeVisible();
  const sent = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/waitlist'));
  await page.getByRole('button', { name: new RegExp(`${Number(there.date.slice(8))}/${Number(there.date.slice(5, 7))} · ${there.time}$`) }).click();
  await page.getByRole('textbox', { name: 'O seu nome' }).fill('Rita Espera');
  await page.getByRole('textbox', { name: 'O seu e-mail' }).fill(WAITER_EMAIL);
  await page.getByRole('button', { name: 'Entrar na lista de espera' }).click();

  const body = (await sent).postDataJSON();
  expect(body.client_time_zone).toBe(SAO_PAULO);
  expect([body.date, body.time]).toEqual([day, '09:00']);
  await expect(page.getByRole('status').filter({ hasText: new RegExp(`Está na lista de espera de .* · ${there.time}\\.`) })).toBeVisible();
});

test('one question at a time: the booking step has the control and the receipt follows it', async ({ page }) => {
  const form = await zoneForm({ layout: 'one_at_a_time' });
  const [day] = nextWeekdays(1);
  const [slot] = await slotsOf(form, day);
  const there = inZone(slot.starts_at, SAO_PAULO);
  const view = new PublicForm(page, form);
  const next = page.getByRole('button', { name: 'Seguinte', exact: true });
  await view.open();
  await page.getByRole('button', { name: 'Começar', exact: true }).click();
  await view.nameBox().fill('Ana Teste');
  await next.click();
  await view.emailBox().fill(uniqueEmail());
  await next.click();

  await zoneSelect(page).selectOption(SAO_PAULO);
  await pickDay(page, there.date);
  await page.getByRole('button', { name: there.time, exact: true }).click();
  await view.submit();

  await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toBeVisible();
  await expect(view.receipt().getByText(new RegExp(`às ${there.time}`))).toBeVisible();
  await expect(view.receipt().getByText(`Horas em ${SAO_PAULO}`)).toBeVisible();
  const [appointment] = await appointmentsOf(form.id);
  expect(new Date(appointment.starts_at).toISOString()).toBe(new Date(slot.starts_at).toISOString());
});

test('with a teacher and a list of lessons the zone stays when the visitor changes lesson', async ({ page }) => {
  const form = await zoneForm({
    mode: 'individual',
    availability: { days: ['mon', 'tue', 'wed', 'thu', 'fri'], times: TIMES },
    services: [lesson('Matemática'), lesson('Física')],
  });
  const [day] = nextWeekdays(1, 3);
  const physics = await slotsOf(form, day, day, form.serviceIds[1]);
  const view = new PublicForm(page, form);
  await view.open();

  await view.chooseService('Matemática');
  await zoneSelect(page).selectOption(SAO_PAULO);
  await view.chooseService('Física');
  await expect(zoneSelect(page)).toHaveValue(SAO_PAULO);

  const evening = physics.find(slot => slot.time === '23:30')!;
  const there = inZone(evening.starts_at, SAO_PAULO);
  await fill(view);
  await view.pickSlot(there.date, there.time);
  await view.submit();
  await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toBeVisible();
  const [appointment] = await appointmentsOf(form.id);
  expect(new Date(appointment.starts_at).toISOString()).toBe(new Date(evening.starts_at).toISOString());
});

test('a refusal names the service and the time in the zone the visitor reads', async ({ page }) => {
  const form = await zoneForm({
    rules: { time_zone: FORM_ZONE, multiple_services: true },
    services: [service('Alfa', { times: TIMES }), service('Beta', { times: TIMES })],
  });
  const [day] = nextWeekdays(1);
  const beta = await slotsOf(form, day, day, form.serviceIds[1]);
  const late = beta.find(slot => slot.time === '23:30')!;
  const there = inZone(late.starts_at, TOKYO);
  await page.route('**/api/public/forms/*/responses', route =>
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        errors: { answers: { [form.bookingId]: ['unavailable'] } },
        details: { [form.bookingId]: { service: form.serviceIds[1], date: day, time: '23:30' } },
      }),
    }),
  );
  const view = new PublicForm(page, form);
  await view.open();
  await zoneSelect(page).selectOption(TOKYO);
  await view.tickService('Alfa');
  await view.tickService('Beta');
  const first = inZone((await slotsOf(form, day, day, form.serviceIds[0]))[0].starts_at, TOKYO);
  await view.pickSlotIn('Alfa', first.date, first.time);
  await view.pickSlotIn('Beta', there.date, there.time);
  await fill(view);
  await view.submit();

  await expect(
    page.getByRole('alert').filter({ hasText: new RegExp(`^A hora de Beta \\(.*${Number(there.date.slice(8))}.*às ${there.time}\\) já não está disponível`) }),
  ).toBeVisible();
});
