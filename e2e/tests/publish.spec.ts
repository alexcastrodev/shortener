import { anonymous, owner } from '../support/api.ts';
import { createForm, ownerForm, republish, service } from '../support/forms.ts';
import { expect, test } from '../support/fixtures.ts';

test('a booking form without name or email question publishes with the Publicar button', async ({ page, signIn }) => {
  const form = await createForm({ name: false, services: [service('Corte')] });
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);

  await page.getByRole('button', { name: 'Publicar', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Publicar', exact: true })).toBeHidden();
  await expect(page.getByText('Publicado · versão 1')).toBeVisible();
  expect((await ownerForm(form.id)).published).toBe(true);

  await page.goto(`/f/${form.publicId}`);
  await expect(page.getByText('Escolha um horário')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible();
});

test('editing a published form asks before publishing the new version and keeps the same link', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Corte')], publish: true });
  const before = await ownerForm(form.id);
  await owner.patch(`/api/me/forms/${form.id}`, { title: `${form.title} editado` });
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);

  await expect(page.getByText('alterações por publicar')).toBeVisible();
  const publicTitle = async () => {
    await page.goto(`/f/${form.publicId}`);
    return page.getByRole('heading', { level: 1 });
  };
  await expect(await publicTitle()).toHaveText(form.title);
  await page.goto(`/app/forms/${form.id}`);

  await page.getByRole('button', { name: 'Publicar alterações' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Publicar a versão 2?')).toBeVisible();
  await expect(dialog.getByText('O link continua o mesmo')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();
  expect((await ownerForm(form.id)).published_version).toBe(1);

  await page.getByRole('button', { name: 'Publicar alterações' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publicar versão 2' }).click();

  await expect(page.getByText('Publicado · versão 2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publicar alterações' })).toBeHidden();
  const after = await ownerForm(form.id);
  expect(after.published_version).toBe(2);
  expect(after.public_url).toBe(before.public_url);
  expect(after.short_url).toBe(before.short_url);
  await expect(await publicTitle()).toHaveText(`${form.title} editado`);
});

test('unpublishing asks first, takes the form offline and publishing again gives the same link', async ({ page, signIn }) => {
  const form = await createForm({ services: [service('Corte')], publish: true });
  const before = await ownerForm(form.id);
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);

  await page.getByRole('button', { name: 'Despublicar' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Tirar o formulário do ar?')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();
  expect((await ownerForm(form.id)).published).toBe(true);

  await page.getByRole('button', { name: 'Despublicar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Despublicar' }).click();
  await expect(page.getByText('Rascunho', { exact: true })).toBeVisible();
  expect((await anonymous.get(`/api/public/forms/${form.publicId}`)).status).toBe(404);

  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByText('Publicado · versão 2')).toBeVisible();
  const after = await ownerForm(form.id);
  expect(after.public_url).toBe(before.public_url);
  expect(after.short_url).toBe(before.short_url);
  expect((await anonymous.get(`/api/public/forms/${form.publicId}`)).status).toBe(200);
});

test('the checklist lists every blocker and each action fixes its own', async ({ page, signIn }) => {
  const form = await createForm({
    name: false,
    services: [service('Completo'), service('Vazio', { times: [] })],
    rules: { verify_email: true },
  });
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);

  const checklist = page.getByRole('status').filter({ hasText: 'Antes de publicar' });
  await expect(checklist.getByText('O serviço “Vazio” precisa de pelo menos um dia e um horário.')).toBeVisible();
  await expect(checklist.getByText(/Com a verificação de e-mail ligada, adicione uma pergunta de e-mail obrigatória/)).toBeVisible();

  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByText('Antes de publicar').first()).toBeVisible();
  expect((await ownerForm(form.id)).published).toBe(false);

  await checklist.getByRole('button', { name: 'Definir' }).click();
  await expect(page.getByRole('button', { name: 'Guardar marcação' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Nome do serviço' })).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: 'Nome do serviço' })).toHaveValue('Vazio');
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await checklist.getByRole('button', { name: 'Adicionar pergunta de e-mail', exact: true }).click();
  await expect(checklist.getByText(/adicione uma pergunta de e-mail obrigatória/)).toBeHidden();
  await expect(checklist.getByText('O serviço “Vazio” precisa de pelo menos um dia e um horário.')).toBeVisible();

  await expect.poll(async () => (await ownerForm(form.id)).fields.filter((field: any) => field.type === 'email')).toMatchObject([
    { required: true },
  ]);
});

test('publishing succeeds once the incomplete service has times', async ({ page, signIn }) => {
  const form = await createForm({
    name: false,
    emails: [{ label: 'O seu e-mail', required: true }],
    services: [service('Vazio', { times: [] })],
    rules: { verify_email: true },
  });
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);

  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByText('O serviço “Vazio” precisa de pelo menos um dia e um horário.')).toBeVisible();
  expect((await ownerForm(form.id)).published).toBe(false);
  const blocked = await republish(form.id);
  expect(blocked.status).toBe(422);
  expect(blocked.body.blocks).toMatchObject([{ code: 'service_incomplete', name: 'Vazio' }]);

  await page.getByRole('button', { name: 'Definir' }).click();
  await page.getByRole('button', { name: 'Gerar horários' }).click();
  await page.getByRole('button', { name: 'Guardar marcação' }).click();
  await expect(page.getByText('Alterações guardadas').first()).toBeVisible();

  await expect(page.getByRole('button', { name: 'Definir' })).toBeHidden();
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByText(/^Publicado · versão/)).toBeVisible();
  expect((await ownerForm(form.id)).published).toBe(true);
});

test('the optional email hint adds an optional email question', async ({ page, signIn }) => {
  const form = await createForm({ name: false, services: [service('Corte')] });
  await signIn('owner');
  await page.goto(`/app/forms/${form.id}`);

  await expect(page.getByText(/Sem uma pergunta de e-mail, ninguém recebe a confirmação/)).toBeVisible();
  await page.getByRole('button', { name: 'Adicionar pergunta de e-mail opcional' }).click();

  await expect(page.getByText(/Sem uma pergunta de e-mail, ninguém recebe a confirmação/)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Adicionar pergunta de e-mail opcional' })).toBeHidden();
  await expect.poll(async () => (await ownerForm(form.id)).fields.filter((field: any) => field.type === 'email')).toMatchObject([
    { required: false },
  ]);
});
