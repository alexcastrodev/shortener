import { owner } from '../support/api.ts';
import { expect, test } from '../support/fixtures.ts';

const zoneOfOwner = async () => (await owner.get('/api/me')).body.user.time_zone;

test('the owner sees the zone of the account, changes it and the choice survives a reload', async ({ page, signIn }) => {
  await signIn('owner');
  try {
    await page.goto('/app/account');
    const select = page.getByRole('combobox', { name: 'Fuso horário' });
    await expect(select).toHaveValue('Europe/Lisbon');

    await select.selectOption('America/Sao_Paulo');
    await expect(page.getByText('Fuso horário guardado')).toBeVisible();
    expect(await zoneOfOwner()).toBe('America/Sao_Paulo');

    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Fuso horário' })).toHaveValue('America/Sao_Paulo');
  } finally {
    await owner.patch('/api/me', { time_zone: 'Europe/Lisbon' });
  }
  expect(await zoneOfOwner()).toBe('Europe/Lisbon');
});
