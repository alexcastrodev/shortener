import { pickDay } from '../support/calendar.ts';
import { nextWeekdays } from '../support/dates.ts';
import { BookingEditor, bookingOf } from '../support/editor.ts';
import { expect, test } from '../support/fixtures.ts';
import { appointmentsOf, createForm, lesson, ownerForm } from '../support/forms.ts';
import { PublicForm } from '../support/public-form.ts';

const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri'];

test('the owner creates a teacher question with one availability and a second lesson', async ({ page, signIn }) => {
  const form = await createForm();
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);

  await page.getByRole('button', { name: 'Marcação de serviço' }).click();
  const choices = page.getByRole('dialog').getByRole('button', { name: /^(Professor|Serviços)/ });
  await expect(choices.first()).toHaveAccessibleName(/^Professor/);
  await expect(choices.first()).toBeFocused();
  const title = await page.getByRole('dialog').getByText('Como se faz a marcação?').boundingBox();
  const first = await choices.first().boundingBox();
  expect(first!.y - (title!.y + title!.height)).toBeGreaterThanOrEqual(30);
  await expect(choices.nth(1)).toHaveAccessibleName(/^Serviços/);
  await choices.first().click();

  const editor = new BookingEditor(page);
  const availability = page.getByRole('region', { name: 'Disponibilidade' });
  const lessons = page.getByRole('region', { name: 'Aulas' });
  await expect(availability.getByText('Seg–Sex · 9 horários')).toBeVisible();
  await expect(availability.getByRole('button', { name: 'Remover o horário 09:00' })).toBeVisible();
  await expect(lessons.getByRole('textbox', { name: 'Nome da aula' })).toHaveValue('Aula');
  await expect(lessons.getByText('60 min · 1 vaga por horário')).toBeVisible();
  await expect(lessons.getByText('Dias em que decorre')).toHaveCount(0);
  await expect(lessons.getByRole('button', { name: 'Remover a aula Aula' }).locator('svg')).toBeVisible();
  await expect(lessons.getByRole('button', { name: /Remover o serviço/ })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Serviços' })).toHaveCount(0);

  await pickDay(page, nextWeekdays(1, 3)[0]);
  await expect(page.getByRole('button', { name: '09:00', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '17:00', exact: true })).toBeVisible();

  await lessons.getByRole('button', { name: 'Adicionar aula' }).click();
  await expect(lessons.getByRole('textbox', { name: 'Nome da aula' })).toHaveCount(2);
  await lessons.getByRole('textbox', { name: 'Nome da aula' }).nth(1).fill('Física');

  await editor.expand('rules');
  await expect(editor.rules.getByRole('switch', { name: /Lista de espera/ })).toHaveCount(0);

  await editor.save();
  await expect(editor.saved).toBeVisible();

  const saved = bookingOf(await ownerForm(form.id));
  expect(saved.mode).toBe('individual');
  expect(saved.availability).toEqual({
    days: WEEK,
    times: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
  });
  expect(saved.categories ?? []).toEqual([]);
  expect(saved.services.map((item: any) => item.name)).toEqual(['Aula', 'Física']);
  for (const item of saved.services) {
    expect(item.id).toBeTruthy();
    expect(item.duration).toBe(60);
    expect(item).not.toHaveProperty('days');
    expect(item).not.toHaveProperty('times');
    expect(item).not.toHaveProperty('times_by_day');
  }
});

test('a time booked for one lesson is no longer offered by the other lesson of the teacher', async ({ page }) => {
  const [day] = nextWeekdays(1, 3);
  const form = await createForm({
    mode: 'individual',
    availability: { days: WEEK, times: ['09:00', '10:00', '11:00'] },
    services: [lesson('Matemática'), lesson('Física')],
    publish: true,
  });
  const view = new PublicForm(page, form);
  const time = (value: string) => page.getByRole('button', { name: value, exact: true });

  await view.open();
  for (const name of ['Matemática', 'Física']) {
    await view.chooseService(name);
    await pickDay(page, day);
    for (const value of ['09:00', '10:00', '11:00']) await expect(time(value)).toBeVisible();
  }

  await view.nameBox().fill('Ana Teste');
  await view.chooseService('Matemática');
  await view.pickSlot(day, '10:00');
  await view.submit();
  await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toBeVisible();
  expect(await appointmentsOf(form.id)).toHaveLength(1);

  await view.open();
  await view.chooseService('Física');
  await pickDay(page, day);
  await expect(time('09:00')).toBeVisible();
  await expect(time('11:00')).toBeVisible();
  await expect(time('10:00')).toHaveCount(0);
});

test('a lesson with its own days and times is offered only at those times, next to a lesson on the hours of the teacher', async ({ page }) => {
  const [day] = nextWeekdays(1, 3);
  const form = await createForm({
    mode: 'individual',
    availability: { days: WEEK, times: ['09:00', '10:00', '11:00'] },
    services: [lesson('Matemática'), lesson('Física', { duration: 90, days: WEEK, times: ['14:00', '16:00'] })],
    publish: true,
  });
  const view = new PublicForm(page, form);
  const time = (value: string) => page.getByRole('button', { name: value, exact: true });

  await view.open();
  await view.chooseService('Matemática');
  await pickDay(page, day);
  await expect(time('09:00')).toBeVisible();
  await expect(time('14:00')).toHaveCount(0);

  await view.chooseService('Física');
  await pickDay(page, day);
  await expect(time('14:00')).toBeVisible();
  await expect(time('16:00')).toBeVisible();
  await expect(time('09:00')).toHaveCount(0);
});

test('the owner gives a lesson its own days and times and the other lesson keeps the availability', async ({ page, signIn }) => {
  const form = await createForm({
    mode: 'individual',
    availability: { days: WEEK, times: ['09:00', '10:00'] },
    services: [lesson('Matemática'), lesson('Física', { duration: 90 })],
  });
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);
  await page.getByRole('button', { name: /Marcação de serviço$/ }).click();

  const editor = new BookingEditor(page);
  const lessons = page.getByRole('region', { name: 'Aulas' });
  const physics = lessons.locator('[id^="service-"]').filter({ hasText: 'Física' });
  await physics.getByRole('button', { name: 'Editar' }).click();
  await expect(physics.getByText('Dias em que decorre')).toHaveCount(0);

  await physics.getByRole('switch', { name: 'Esta aula tem dias e horários próprios' }).check();
  await expect(physics.getByText('Dias em que decorre')).toBeVisible();
  await editor.save();
  await expect(editor.saved).toBeVisible();

  const saved = bookingOf(await ownerForm(form.id));
  const [math, physicsSaved] = saved.services;
  expect(math).not.toHaveProperty('days');
  expect(math).not.toHaveProperty('times');
  expect(physicsSaved.days).toEqual(WEEK);
  expect(physicsSaved.times).toHaveLength(6);
  expect(saved.availability.times).toEqual(['09:00', '10:00']);
});

test('the teacher mode talks about lessons when several can be booked together', async ({ page, signIn }) => {
  const form = await createForm({
    mode: 'individual',
    availability: { days: WEEK, times: ['09:00', '10:00'] },
    services: [lesson('Guitarra'), lesson('Bateria')],
  });
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);
  await page.getByRole('button', { name: /Marcação de serviço$/ }).click();

  const editor = new BookingEditor(page);
  await editor.expand('rules');
  await expect(editor.rules.getByRole('switch', { name: 'Vários serviços na mesma marcação' })).toHaveCount(0);
  await editor.rules.getByRole('switch', { name: 'Várias aulas na mesma marcação' }).click();
  await editor.save();
  await expect(editor.saved).toBeVisible();
  expect(bookingOf(await ownerForm(form.id)).rules.multiple_services).toBe(true);
});

test('the publish checklist asks for the hours of the teacher and publishing works once they are set', async ({ page, signIn }) => {
  const form = await createForm({
    mode: 'individual',
    availability: { days: WEEK, times: [] },
    services: [lesson('Matemática')],
  });
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);

  const block = page.getByText('Escolha pelo menos um dia e um horário em que está disponível.');
  await expect(block).toBeVisible();
  await page.getByRole('button', { name: 'Abrir pergunta de marcação' }).click();

  const editor = new BookingEditor(page);
  const availability = page.getByRole('region', { name: 'Disponibilidade' });
  await editor.save();
  await expect(editor.invalid).toBeVisible();
  await expect(availability.getByText('Adicione pelo menos um horário')).toBeVisible();

  await availability.getByRole('button', { name: 'Gerar horários' }).click();
  await expect(availability.getByText('9 horários criados.')).toBeVisible();
  await editor.save();
  await expect(editor.saved).toBeVisible();
  await expect(block).toBeHidden();
  expect(bookingOf(await ownerForm(form.id)).availability.times).toHaveLength(9);

  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByText('Publicado · versão 1')).toBeVisible();
  expect((await ownerForm(form.id)).published).toBe(true);
});

test('the availability of the teacher is optional, and publishing works, while every lesson has its own days and times', async ({ page, signIn }) => {
  const form = await createForm({
    mode: 'individual',
    availability: { days: [], times: [] },
    services: [
      lesson('Matemática', { days: WEEK, times: ['09:00', '10:00'] }),
      lesson('Física', { duration: 90, days: ['tue', 'thu'], times: ['14:00'] }),
    ],
  });
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);

  await expect(page.getByText('Escolha pelo menos um dia e um horário em que está disponível.')).toHaveCount(0);
  await page.getByRole('button', { name: /Marcação de serviço$/ }).click();
  const editor = new BookingEditor(page);
  const availability = page.getByRole('region', { name: 'Disponibilidade' });
  await expect(availability.getByText('Opcional enquanto todas as aulas tiverem os seus próprios dias e horários.')).toBeVisible();

  await editor.save();
  await expect(editor.saved).toBeVisible();
  await expect(editor.invalid).toHaveCount(0);
  await expect(availability.getByText('Adicione pelo menos um horário')).toHaveCount(0);
  expect(bookingOf(await ownerForm(form.id)).availability).toEqual({ days: [], times: [] });

  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByText('Publicado · versão 1')).toBeVisible();
  expect((await ownerForm(form.id)).published).toBe(true);
});

test('the availability of the teacher is asked for again as soon as one lesson has no days and times of its own', async ({ page, signIn }) => {
  const form = await createForm({
    mode: 'individual',
    availability: { days: [], times: [] },
    services: [lesson('Matemática', { days: WEEK, times: ['09:00'] }), lesson('Física')],
  });
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);

  await expect(page.getByText('Escolha pelo menos um dia e um horário em que está disponível.')).toBeVisible();
  await page.getByRole('button', { name: 'Abrir pergunta de marcação' }).click();
  const editor = new BookingEditor(page);
  const availability = page.getByRole('region', { name: 'Disponibilidade' });
  await expect(availability.getByText('Opcional enquanto todas as aulas tiverem os seus próprios dias e horários.')).toHaveCount(0);
  await editor.save();
  await expect(editor.invalid).toBeVisible();
  await expect(availability.getByText('Adicione pelo menos um horário')).toBeVisible();
});
