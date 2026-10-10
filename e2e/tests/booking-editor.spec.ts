import { pickDay } from '../support/calendar.ts';
import { BookingEditor, bookingOf } from '../support/editor.ts';
import { nextWeekdays } from '../support/dates.ts';
import { expect, test } from '../support/fixtures.ts';
import { createForm, ownerForm, service } from '../support/forms.ts';

test('adding the booking question creates a ready service and the preview shows a calendar', async ({ page, signIn }) => {
  const form = await createForm();
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);

  await page.getByRole('button', { name: 'Marcação de serviço' }).click();

  const editor = new BookingEditor(page);
  await expect(editor.services.getByText('30 min · 1 vaga por horário')).toBeVisible();
  await expect(editor.services.getByText('Seg–Sex · 18 horários')).toBeVisible();
  await expect(editor.serviceField('Nome do serviço')).toHaveValue('Sessão');
  await expect(page.getByRole('button', { name: 'Mês seguinte' })).toBeVisible();
  await expect(page.getByText('Escolha um dia no calendário para ver as horas.')).toBeVisible();
  await pickDay(page, nextWeekdays(1, 3)[0]);
  await expect(page.getByRole('button', { name: '09:00', exact: true })).toBeVisible();

  await expect.poll(async () => bookingOf(await ownerForm(form.id))?.services.length).toBe(1);
  const [created] = bookingOf(await ownerForm(form.id)).services;
  expect(created).toMatchObject({ name: 'Sessão', duration: 30, capacity: 1 });
  expect(created.times).toHaveLength(18);
  expect(created.times[0]).toBe('09:00');
  expect(created.times[17]).toBe('17:30');
});

test('one save persists a new service, a price and a day off', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Corte', { times: ['09:00'] })] });
  const [day] = nextWeekdays(1);
  await signIn('owner');
  const editor = new BookingEditor(page);
  await editor.open(form.id);

  await editor.serviceField('Preço').fill('25');
  const added = await editor.addService('Massagem');
  await expect(editor.services.getByText('Seg–Sex · 18 horários')).toBeVisible();
  expect(added).toBe(1);

  await editor.expand('daysOff');
  await editor.daysOff.getByRole('textbox', { name: 'Data', exact: true }).fill(day);
  await editor.daysOff.getByRole('button', { name: 'Adicionar', exact: true }).click();

  await editor.save();
  await expect(editor.saved).toBeVisible();

  const saved = bookingOf(await ownerForm(form.id));
  expect(saved.services).toHaveLength(2);
  const [corte, massagem] = saved.services;
  expect(corte).toMatchObject({ name: 'Corte', times: ['09:00'] });
  expect(corte.price).toBeTruthy();
  expect(massagem.name).toBe('Massagem');
  expect(massagem.id).toBeTruthy();
  expect(massagem.times).toHaveLength(18);
  expect(saved.exceptions).toHaveLength(1);
  expect(saved.exceptions[0]).toMatchObject({ from: day, kind: 'closed' });
  expect(saved.exceptions[0].id).toBeTruthy();
});

test('a service without times blocks the save until the generator creates them', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Corte', { times: ['09:00'] })] });
  await signIn('owner');
  const editor = new BookingEditor(page);
  await editor.open(form.id);

  await editor.services.getByRole('button', { name: 'Remover o horário 09:00' }).click();
  await editor.save();

  await expect(editor.invalid).toBeVisible();
  await expect(editor.services.getByText('Adicione pelo menos um horário').first()).toBeVisible();
  await expect(editor.services.getByText('Horário de trabalho')).toBeVisible();
  expect(bookingOf(await ownerForm(form.id)).services[0].times).toEqual(['09:00']);

  await editor.services.getByRole('button', { name: 'Gerar horários' }).click();
  await expect(editor.services.getByText('18 horários criados.')).toBeVisible();
  await expect(editor.services.getByText('Adicione pelo menos um horário')).toBeHidden();

  await editor.save();
  await expect(editor.saved).toBeVisible();
  expect(bookingOf(await ownerForm(form.id)).services[0].times).toHaveLength(18);
});

test('the booking rules persist after a reload and show in the summary', async ({ page, signIn }) => {
  const form = await createForm({
    emails: [{ label: 'E-mail', required: true }],
    services: [service('Corte')],
  });
  await signIn('owner');
  const editor = new BookingEditor(page);
  await editor.open(form.id);
  await editor.expand('rules');

  await editor.rules.getByText('Eu aprovo cada uma').click();
  await editor.rules.getByRole('switch', { name: /Lista de espera para horários cheios/ }).click();
  await editor.rules.getByRole('textbox', { name: 'Tempo para confirmar um lugar' }).fill('12');
  await editor.rules.getByRole('combobox', { name: 'Tempo para confirmar um lugar' }).click();
  await page.getByRole('option', { name: 'horas', exact: true }).click();
  await editor.rules.getByRole('textbox', { name: 'Intervalo entre sessões (minutos)' }).fill('15');
  await editor.rules.getByRole('textbox', { name: 'Máximo por dia (opcional)' }).fill('5');

  await editor.save();
  await expect(editor.saved).toBeVisible();

  const { rules } = bookingOf(await ownerForm(form.id));
  expect(rules).toMatchObject({
    approval: 'manual',
    waitlist: true,
    waitlist_confirm_minutes: 720,
    buffer_minutes: 15,
    max_per_day: 5,
  });

  await editor.open(form.id);
  await expect(editor.rules.getByText(/Aprova cada marcação/)).toBeVisible();
  await expect(editor.rules.getByText(/Lista de espera/)).toBeVisible();
  await editor.expand('rules');
  await expect(editor.rules.getByRole('textbox', { name: 'Intervalo entre sessões (minutos)' })).toHaveValue('15');
  await expect(editor.rules.getByRole('textbox', { name: 'Máximo por dia (opcional)' })).toHaveValue('5');
  await expect(editor.rules.getByRole('textbox', { name: 'Tempo para confirmar um lugar' })).toHaveValue('12');
});

test('a single category shows the hint that two are needed', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Corte')] });
  await signIn('owner');
  const editor = new BookingEditor(page);
  await editor.open(form.id);

  const hint = 'As categorias só são guardadas e mostradas ao cliente quando há pelo menos duas.';
  await expect(editor.services.getByText(hint)).toBeHidden();

  await editor.services.getByRole('textbox', { name: 'Nova categoria' }).fill('Cabelo');
  await editor.services.getByRole('textbox', { name: 'Nova categoria' }).press('Enter');
  await expect(editor.services.getByRole('textbox', { name: 'Nome da categoria' })).toHaveValue('Cabelo');
  await expect(editor.services.getByText(hint)).toBeVisible();

  await editor.services.getByRole('textbox', { name: 'Nova categoria' }).fill('Barba');
  await editor.services.getByRole('textbox', { name: 'Nova categoria' }).press('Enter');
  await expect(editor.services.getByRole('textbox', { name: 'Nome da categoria' })).toHaveCount(2);
  await expect(editor.services.getByText(hint)).toBeHidden();
});

test('a service can offer unlimited places and go back to a number', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Aula', { capacity: 3 })] });
  await signIn('owner');
  const editor = new BookingEditor(page);
  await editor.open(form.id);

  const places = editor.serviceField('Vagas por horário');
  const unlimited = editor.services.getByRole('checkbox', { name: 'Sem limite de vagas' });
  await expect(places).toHaveValue('3');
  await expect(unlimited).not.toBeChecked();

  await unlimited.check();
  await expect(places).toBeDisabled();
  await expect(places).toHaveValue('');
  await editor.save();
  await expect(editor.saved).toBeVisible();
  await expect.poll(async () => bookingOf(await ownerForm(form.id)).services[0].capacity ?? null).toBeNull();

  await unlimited.uncheck();
  await expect(places).toBeEnabled();
  await expect(places).toHaveValue('1');
  await places.fill('5');
  await editor.save();
  await expect(editor.saved).toBeVisible();
  await expect.poll(async () => bookingOf(await ownerForm(form.id)).services[0].capacity).toBe(5);
});

test('the no-limit label stays on one small line', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Aula', { capacity: 3 })] });
  await signIn('owner');
  const editor = new BookingEditor(page);
  await editor.open(form.id);

  const unlimited = editor.services.getByRole('checkbox', { name: 'Sem limite de vagas' });
  const label = await unlimited.evaluate(input => {
    const element = (input as HTMLInputElement).labels![0];
    const style = getComputedStyle(element);
    return { lines: Math.round(element.getBoundingClientRect().height / parseFloat(style.lineHeight)), size: parseFloat(style.fontSize), wrap: style.whiteSpace };
  });
  expect(label.wrap).toBe('nowrap');
  expect(label.lines).toBe(1);
  expect(label.size).toBeLessThanOrEqual(12);
});

test('the preview lays the form out at the width of a real phone and of a laptop', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Sessão')] });
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);

  const screen = page.getByTestId('preview-screen');
  await expect(screen.getByRole('heading', { name: form.title })).toBeVisible();
  const size = () => screen.evaluate(element => ({ width: element.clientWidth, overflow: element.scrollWidth - element.clientWidth }));
  expect(await size()).toEqual({ width: 390, overflow: 0 });

  await page.getByText('Computador', { exact: true }).click();
  await expect(screen.getByRole('heading', { name: form.title })).toBeVisible();
  expect(await size()).toEqual({ width: 1024, overflow: 0 });
});

test('on a phone, adding a question does not scroll the screen to the preview', async ({ page, signIn }) => {
  const form = await createForm();
  await signIn('owner');
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`/app/forms/${form.id}`);

  const add = page.getByRole('button', { name: 'Marcação de serviço' });
  const preview = page.getByText('Pré-visualização', { exact: true });
  await add.scrollIntoViewIfNeeded();
  const before = (await preview.boundingBox())!.y;
  await add.click();
  await expect(page.getByRole('region', { name: 'Serviços' })).toBeAttached();
  await page.waitForTimeout(800);
  expect(Math.abs((await preview.boundingBox())!.y - before)).toBeLessThan(80);
});
