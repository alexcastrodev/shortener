import { createForm, service } from '../support/forms.ts';
import { expect, test } from '../support/fixtures.ts';

test('the owner opens a form in the editor and the public form renders', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Sessão')], publish: true });
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);
  await expect(page.getByRole('textbox', { name: 'Título', exact: true })).toHaveValue(form.title);

  await page.goto(`/f/${form.publicId}`);
  await expect(page.getByText('Escolha um horário')).toBeVisible();
});
