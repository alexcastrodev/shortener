import type { Page } from '@playwright/test';
import { pickDay } from '../support/calendar.ts';
import { nextWeekdays } from '../support/dates.ts';
import { expect, test } from '../support/fixtures.ts';
import { owner } from '../support/api.ts';
import { createForm, service, type FormOptions } from '../support/forms.ts';
import { PublicForm, uniqueEmail } from '../support/public-form.ts';

async function book(page: Page, options: FormOptions, message?: string) {
  const form = await createForm({ name: true, emails: [{ label: 'E-mail', required: true }], publish: true, ...options });
  if (message) {
    await owner.patch(`/api/me/forms/${form.id}`, { thank_you_message: message });
    await owner.post(`/api/me/forms/${form.id}/publish`);
  }
  const view = new PublicForm(page, form);
  await view.open();
  await view.nameBox().fill('Ana Teste');
  await view.emailBox().fill(uniqueEmail());
  await pickDay(page, day);
  await page.getByRole('button', { name: '09:00', exact: true }).click();
  await view.submit();
  return view;
}

const [day] = nextWeekdays(1, 3);

const top = async (locator: ReturnType<Page['locator']>) => (await locator.boundingBox())!.y;

test('a confirmed booking leads with the status, then the details, then the way to manage it', async ({ page }) => {
  await book(page, { services: [service('Corte de cabelo', { price: 15, currency: 'EUR' })] });

  const title = page.getByRole('heading', { name: 'Marcação confirmada', level: 1 });
  await expect(title).toBeVisible();
  await expect(page.getByText('Está tudo pronto. Pode ver ou cancelar a marcação quando quiser.')).toBeVisible();

  const details = page.getByRole('region', { name: 'A sua marcação' });
  await expect(details.getByText('Corte de cabelo')).toBeVisible();
  await expect(details.getByText(/15,00\s*€/)).toBeVisible();
  await expect(details.getByText(new RegExp(`\\b${Number(day.slice(8))} de .* às 09:00`))).toBeVisible();

  const manage = page.getByRole('link', { name: 'Ver ou cancelar a marcação' });
  await expect(manage).toHaveAttribute('href', /\/m\//);

  expect(await top(title)).toBeLessThan(await top(details));
  expect(await top(details)).toBeLessThan(await top(manage));
});

test('a request waiting for approval says so in the title and keeps the details', async ({ page }) => {
  await book(page, { services: [service('Consulta')], rules: { approval: 'manual' } });

  await expect(page.getByRole('heading', { name: 'Pedido enviado', level: 1 })).toBeVisible();
  await expect(page.getByText('O seu pedido de marcação aguarda aprovação. Avisamos quando houver resposta.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'A sua marcação' }).getByText('Consulta')).toBeVisible();
});

test('an unconfirmed e-mail is the title, and the explanation comes straight after it', async ({ page }) => {
  await book(page, { services: [service('Aula')], rules: { verify_email: true } });

  const title = page.getByRole('heading', { name: /Falta confirmar o e.mail/, level: 1 });
  await expect(title).toBeVisible();
  const lead = page.getByText(/ligação para confirmar o endereço/);
  await expect(lead).toBeVisible();
  expect(await top(title)).toBeLessThan(await top(lead));
});

test('the message written by the owner is the lead of a confirmed booking', async ({ page }) => {
  await book(page, { services: [service('Sessão')] }, 'Até já! Traga roupa confortável.');

  await expect(page.getByText('Até já! Traga roupa confortável.')).toBeVisible();
  await expect(page.getByText('Está tudo pronto. Pode ver ou cancelar a marcação quando quiser.')).toHaveCount(0);
});

test('a form without a booking keeps the simple thank you', async ({ page }) => {
  const form = await createForm({ name: true, publish: true });
  const view = new PublicForm(page, form);
  await view.open();
  await view.nameBox().fill('Ana Teste');
  await view.submit();

  await expect(page.getByRole('heading', { name: 'Obrigado', level: 1 })).toBeVisible();
  await expect(page.getByText('As suas respostas foram enviadas.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'A sua marcação' })).toHaveCount(0);
});
