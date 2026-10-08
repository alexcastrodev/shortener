import { addDayOff, BookingEditor, bookingOf, shortDate, showDay } from '../support/editor.ts';
import { nextWeekdays } from '../support/dates.ts';
import { expect, test } from '../support/fixtures.ts';
import { createForm, ownerForm, republish, service } from '../support/forms.ts';
import { anonymous } from '../support/api.ts';

const slotTimes = async (publicId: string, serviceId: string, day: string) => {
  const { body } = await anonymous.get(`/api/public/forms/${publicId}/slots?service=${serviceId}&from=${day}&to=${day}`);
  return (body.slots as any[]).map(slot => slot.time);
};

test('a closed day, a period with a note and special hours are listed, summarised and saved', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Corte')] });
  const [first, second, third, fourth] = nextWeekdays(4);
  await signIn('owner');
  const editor = new BookingEditor(page);
  await editor.open(form.id);
  await editor.expand('daysOff');

  await addDayOff(editor, { from: first });
  await expect(editor.daysOff.getByText(`${shortDate(first)} fechado`, { exact: true })).toBeVisible();
  await expect(editor.daysOff.getByRole('button', { name: `Remover ${shortDate(first)}` })).toBeVisible();

  await addDayOff(editor, { from: second, to: fourth, note: 'Férias' });
  const period = `${shortDate(second)} – ${shortDate(fourth)}`;
  await expect(editor.daysOff.getByRole('button', { name: `Remover ${period}` })).toBeVisible();
  await expect(editor.daysOff.getByText('Férias', { exact: true })).toBeVisible();
  await expect(editor.daysOff.getByText(`${shortDate(first)} fechado · ${period} fechado`)).toBeVisible();

  await addDayOff(editor, { from: third, special: '11:00' });
  await expect(editor.daysOff.getByRole('button', { name: `Remover ${shortDate(third)}` })).toBeVisible();
  await expect(editor.daysOff.getByText('11:00', { exact: true })).toBeVisible();

  await editor.save();
  await expect(editor.saved).toBeVisible();

  const { exceptions } = bookingOf(await ownerForm(form.id));
  expect(exceptions).toHaveLength(3);
  for (const item of exceptions) expect(item.id).toBeTruthy();
  expect(exceptions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ from: first, kind: 'closed' }),
      expect.objectContaining({ from: second, to: fourth, kind: 'closed', note: 'Férias' }),
      expect.objectContaining({ from: third, kind: 'special', times: ['11:00'] }),
    ]),
  );
});

test('adding without a date or with the end before the start shows an error', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Corte')] });
  const [first, second] = nextWeekdays(2);
  await signIn('owner');
  const editor = new BookingEditor(page);
  await editor.open(form.id);
  await editor.expand('daysOff');

  await editor.daysOff.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(editor.daysOff.getByText('Escolha a data')).toBeVisible();

  await editor.daysOff.getByRole('textbox', { name: 'Data', exact: true }).fill(second);
  await editor.daysOff.getByRole('textbox', { name: 'Até (opcional)' }).fill(first);
  await editor.daysOff.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(editor.daysOff.getByText('O fim não pode ser antes do início')).toBeVisible();
  await expect(editor.daysOff.getByText('Ainda sem folgas.')).toBeVisible();

  await editor.daysOff.getByRole('textbox', { name: 'Até (opcional)' }).fill(second);
  await editor.daysOff.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(editor.daysOff.getByText('O fim não pode ser antes do início')).toBeHidden();
  await expect(editor.daysOff.getByRole('button', { name: /^Remover / })).toHaveCount(1);
});

test('a date typed but not added blocks saving until it is cleared', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Corte')] });
  const [day] = nextWeekdays(1);
  await signIn('owner');
  const editor = new BookingEditor(page);
  await editor.open(form.id);
  await editor.expand('daysOff');

  await editor.serviceField('Nome do serviço').fill('Corte longo');
  await editor.daysOff.getByRole('textbox', { name: 'Data', exact: true }).fill(day);
  await editor.save();

  await expect(editor.daysOff.getByText('Clique em Adicionar para incluir esta folga, ou limpe a data.')).toBeVisible();
  await expect(editor.invalid).toBeVisible();
  const blocked = bookingOf(await ownerForm(form.id));
  expect(blocked.services[0].name).toBe('Corte');
  expect(blocked.exceptions).toHaveLength(0);

  await editor.daysOff.getByRole('textbox', { name: 'Data', exact: true }).clear();
  await editor.save();
  await expect(editor.saved).toBeVisible();
  const saved = bookingOf(await ownerForm(form.id));
  expect(saved.services[0].name).toBe('Corte longo');
  expect(saved.exceptions).toHaveLength(0);
});

test('a day off scoped to one service closes the calendar only for that service', async ({ page, signIn }) => {
  const form = await createForm({
    services: [service('Corte', { times: ['09:00'] }), service('Massagem', { times: ['10:00'] })],
    publish: true,
  });
  const [day] = nextWeekdays(1, 3);
  await signIn('owner');
  const editor = new BookingEditor(page);
  await editor.open(form.id);
  await editor.expand('daysOff');

  await expect(editor.daysOff.getByText('Todos os serviços')).toBeVisible();
  await editor.daysOff.getByText('Corte', { exact: true }).click();
  await expect(editor.daysOff.getByText('Só nos serviços escolhidos.')).toBeVisible();
  await addDayOff(editor, { from: day });
  await editor.save();
  await expect(editor.saved).toBeVisible();

  const saved = bookingOf(await ownerForm(form.id));
  const [corte, massagem] = saved.services;
  expect(saved.exceptions).toHaveLength(1);
  expect(saved.exceptions[0].service_ids).toEqual([corte.id]);

  expect((await republish(form.id)).status).toBe(200);
  expect(await slotTimes(form.publicId, corte.id, day)).toEqual([]);
  expect(await slotTimes(form.publicId, massagem.id, day)).toEqual(['10:00']);

  await page.goto(`/f/${form.publicId}`);
  await page.getByRole('radio', { name: /^Corte/ }).click();
  await expect(await showDay(page, day)).toBeDisabled();
  await page.getByRole('radio', { name: /^Massagem/ }).click();
  await expect(await showDay(page, day)).toBeEnabled();
});

test('special hours replace the service times and removing an entry deletes it', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Corte', { times: ['09:00', '10:00'] })], publish: true });
  const [special, closed] = nextWeekdays(2, 3);
  await signIn('owner');
  const editor = new BookingEditor(page);
  await editor.open(form.id);
  await editor.expand('daysOff');

  await addDayOff(editor, { from: special, special: '11:00' });
  await addDayOff(editor, { from: closed });
  await editor.save();
  await expect(editor.saved).toBeVisible();

  const saved = bookingOf(await ownerForm(form.id));
  expect(saved.exceptions).toHaveLength(2);
  const serviceId = saved.services[0].id;
  await republish(form.id);
  expect(await slotTimes(form.publicId, serviceId, special)).toEqual(['11:00']);
  expect(await slotTimes(form.publicId, serviceId, closed)).toEqual([]);

  await editor.open(form.id);
  await editor.expand('daysOff');
  await editor.daysOff.getByRole('button', { name: `Remover ${shortDate(special)}` }).click();
  await expect(editor.daysOff.getByRole('button', { name: /^Remover / })).toHaveCount(1);
  await editor.save();
  await expect(editor.saved).toBeVisible();

  const after = bookingOf(await ownerForm(form.id));
  expect(after.exceptions).toHaveLength(1);
  expect(after.exceptions[0]).toMatchObject({ from: closed, kind: 'closed' });
  await republish(form.id);
  expect(await slotTimes(form.publicId, serviceId, special)).toEqual(['09:00', '10:00']);
});

test('the collapsed summary shows two entries and counts the rest', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Corte')] });
  const [first, second, third] = nextWeekdays(3);
  await signIn('owner');
  const editor = new BookingEditor(page);
  await editor.open(form.id);
  await expect(editor.daysOff.getByText('Sem folgas nem horários especiais')).toBeVisible();
  await editor.expand('daysOff');

  await addDayOff(editor, { from: first });
  await addDayOff(editor, { from: second });
  await expect(editor.daysOff.getByText(`${shortDate(first)} fechado · ${shortDate(second)} fechado`, { exact: true })).toBeVisible();
  await addDayOff(editor, { from: third });
  await editor.daysOff.getByRole('button', { name: 'Fechar' }).click();

  await expect(
    editor.daysOff.getByText(`${shortDate(first)} fechado · ${shortDate(second)} fechado · +1`, { exact: true }),
  ).toBeVisible();
});
