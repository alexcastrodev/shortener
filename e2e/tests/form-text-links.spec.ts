import { expect, test } from '../support/fixtures.ts';
import { owner } from '../support/api.ts';
import { createForm, service } from '../support/forms.ts';
import { PublicForm } from '../support/public-form.ts';
import { nextWeekdays } from '../support/dates.ts';

test('http and https links in the intro and in the thank-you message are clickable, plain text is not', async ({ page }) => {
  const form = await createForm({ services: [service('Corte')], publish: true });
  await owner.patch(`/api/me/forms/${form.id}`, {
    description: 'Marque aqui. Ver preços em https://exemplo.pt/precos, por favor.\nTexto sem ligação: www.exemplo.pt',
    thank_you_message: 'Obrigado! Guia em http://exemplo.pt/guia.\nJavaScript: javascript:alert(1)',
  });
  await owner.post(`/api/me/forms/${form.id}/publish`);
  const view = new PublicForm(page, form);
  await view.open();

  const intro = page.getByRole('link', { name: 'https://exemplo.pt/precos' });
  await expect(intro).toHaveAttribute('href', 'https://exemplo.pt/precos');
  await expect(intro).toHaveAttribute('target', '_blank');
  await expect(intro).toHaveAttribute('rel', /noopener/);
  await expect(page.getByText(/Marque aqui\. Ver preços em .*, por favor\./)).toBeVisible();
  await expect(page.getByRole('link', { name: /www\.exemplo\.pt/ })).toHaveCount(0);

  const [day] = nextWeekdays(1, 3);
  await view.nameBox().fill('Ana Teste');
  await view.pickSlot(day, '09:00');
  await view.submit();

  await expect(page.getByRole('heading', { name: 'Marcação confirmada' })).toBeVisible();
  const thanks = page.getByRole('link', { name: 'http://exemplo.pt/guia' });
  await expect(thanks).toHaveAttribute('href', 'http://exemplo.pt/guia');
  await expect(page.getByRole('link', { name: /javascript/i })).toHaveCount(0);
  await expect(page.getByText(/javascript:alert\(1\)/)).toBeVisible();
});
