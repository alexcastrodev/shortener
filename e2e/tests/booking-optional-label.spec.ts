import { BookingEditor, bookingOf } from '../support/editor.ts';
import { nextWeekdays } from '../support/dates.ts';
import { expect, test } from '../support/fixtures.ts';
import { appointmentsOf, createForm, ownerForm, service } from '../support/forms.ts';
import { PublicForm } from '../support/public-form.ts';

const TYPE_NAME = 'Marcação de serviço';
const LABEL = 'Escolha um horário';

test('the owner saves the booking question without a label and can give it back', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Corte')] });
  await signIn('owner');
  const editor = new BookingEditor(page);
  await editor.open(form.id);

  const box = page.getByRole('textbox', { name: 'Pergunta', exact: true });
  await expect(box).toHaveValue(LABEL);
  await expect(page.getByText('Opcional. Deixe vazio para mostrar os serviços sem título.')).toBeVisible();
  await expect(box).not.toHaveAttribute('required');

  await box.fill('');
  await editor.save();
  await expect(editor.saved).toBeVisible();
  await expect(editor.invalid).toBeHidden();

  const cleared = bookingOf(await ownerForm(form.id));
  expect(cleared).not.toHaveProperty('label');
  expect(cleared.services).toHaveLength(1);

  const row = page.getByRole('button', { name: new RegExp(`^${TYPE_NAME}$`) });
  await expect(row).toBeVisible();

  await page.reload();
  await row.click();
  await expect(box).toHaveValue('');

  await box.fill('Marque aqui');
  await editor.save();
  await expect(editor.saved).toBeVisible();
  expect(bookingOf(await ownerForm(form.id)).label).toBe('Marque aqui');
  await expect(page.getByRole('button', { name: new RegExp(`^Marque aqui\\s*${TYPE_NAME}$`) })).toBeVisible();
});

test('another question still needs its label', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Corte')] });
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);

  await page.getByRole('button', { name: /^Nome\s*\*?\s*Resposta curta$/ }).click();
  const box = page.getByRole('textbox', { name: 'Pergunta', exact: true });
  await expect(box).toHaveAttribute('required');
  await box.fill('');
  await page.getByRole('button', { name: 'Guardar pergunta' }).click();

  await expect(page.getByText('Alterações guardadas')).toHaveCount(0);
  expect((await ownerForm(form.id)).fields[0].label).toBe('Nome');
});

for (const layout of ['page', 'steps', 'one_at_a_time'] as const) {
  test(`${layout}: without a label the form shows no heading for the booking and still books`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    const form = await createForm({ layout, bookingLabel: null, services: [service('Sessão')], publish: true });
    const view = new PublicForm(page, form);
    await view.open();

    if (layout === 'one_at_a_time') {
      await page.getByRole('button', { name: 'Começar', exact: true }).click();
      await view.nameBox().fill('Ana Teste');
      await page.getByRole('button', { name: 'Seguinte', exact: true }).click();
      await expect(page.getByText('Pergunta 2 de 2')).toBeVisible();
      const group = page.getByRole('group', { name: TYPE_NAME, exact: true });
      await expect(group).toBeVisible();
      const around = await group.evaluate(element => ({
        before: element.previousElementSibling?.getAttribute('aria-live'),
        labels: element.parentElement!.querySelectorAll(':scope > label').length,
      }));
      expect(around).toEqual({ before: 'polite', labels: 0 });
    } else {
      const wrap = page.locator(`[id$="-wrap-${form.bookingId}"]`);
      await expect(wrap.locator('label')).toHaveCount(0);
      await expect(wrap.getByRole('group', { name: TYPE_NAME, exact: true })).toBeVisible();
      const start = await wrap.evaluate(element => ({
        role: element.firstElementChild?.getAttribute('role'),
        gap: element.firstElementChild!.getBoundingClientRect().top - element.getBoundingClientRect().top,
      }));
      expect(start).toEqual({ role: 'group', gap: 0 });
      await view.nameBox().fill('Ana Teste');
    }

    await expect(page.getByRole('group', { name: TYPE_NAME, exact: true })).toBeVisible();
    await expect(page.getByText(/undefined|null/)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await view.pickSlot(nextWeekdays(1)[0], '09:00');
    await view.submit();

    await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toBeVisible();
    const [appointment] = await appointmentsOf(form.id);
    expect(appointment).toMatchObject({ client_name: 'Ana Teste' });
  });
}

test('with a label the form shows it above the booking, as before', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const form = await createForm({ services: [service('Sessão')], publish: true });
  const view = new PublicForm(page, form);
  await view.open();

  const wrap = page.locator(`[id$="-wrap-${form.bookingId}"]`);
  await expect(wrap.locator('label')).toHaveText(LABEL);
  await expect(wrap.getByRole('group', { name: LABEL, exact: true })).toBeVisible();
  expect(await wrap.evaluate(element => element.firstElementChild?.tagName)).toBe('LABEL');

  await view.nameBox().fill('Ana Teste');
  await view.pickSlot(nextWeekdays(1)[0], '09:00');
  await view.submit();
  await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toBeVisible();
});

test('a required booking without a label asks for a day and a time without quoting the label', async ({ page }) => {
  const form = await createForm({ layout: 'one_at_a_time', bookingLabel: null, bookingRequired: true, services: [service('Sessão')], publish: true });
  const view = new PublicForm(page, form);
  await view.open();
  await page.getByRole('button', { name: 'Começar', exact: true }).click();
  await view.nameBox().fill('Ana Teste');
  await page.getByRole('button', { name: 'Seguinte', exact: true }).click();

  await page.getByRole('button', { name: 'Enviar', exact: true }).click();

  await expect(page.getByRole('alert')).toHaveText('Esta pergunta é obrigatória');
  await expect(page.getByText('*', { exact: true })).toHaveCount(0);
});

test('the preview in the editor follows the box: no heading once it is cleared', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Corte')] });
  await signIn('owner');
  const editor = new BookingEditor(page);
  await editor.open(form.id);

  const preview = page.getByTestId('preview-screen');
  await expect(preview.getByText(LABEL)).toBeVisible();

  await page.getByRole('textbox', { name: 'Pergunta', exact: true }).fill('');

  await expect(preview.getByText(LABEL)).toHaveCount(0);
  await expect(preview.getByRole('group', { name: TYPE_NAME, exact: true })).toBeVisible();
});
