import type { Page } from '@playwright/test';

export const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00Z`));

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function pickDay(page: Page, iso: string) {
  const target = page.getByRole('button', { name: new RegExp(`^${escape(dayLabel(iso))}`) });
  for (let step = 0; step < 3 && (await target.count()) === 0; step++) {
    await page.getByRole('button', { name: 'Mês seguinte' }).click();
  }
  await target.click();
}
