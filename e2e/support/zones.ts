import type { Page } from '@playwright/test';
import { anonymous } from './api.ts';
import type { CreatedForm } from './forms.ts';

export type OfferedSlot = { starts_at: string; date: string; time: string };

export async function slotsOf(form: CreatedForm, from: string, to = from, service = form.serviceIds[0]): Promise<OfferedSlot[]> {
  const response = await anonymous.get(
    `/api/public/forms/${form.publicId}/slots?service=${service}&from=${from}&to=${to}`,
  );
  if (response.status !== 200) throw new Error(`slots failed: ${response.status}`);
  return response.body.slots;
}

export function inZone(instant: string, zone: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(instant))
      .map(part => [part.type, part.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export const zoneSelect = (page: Page) => page.getByRole('combobox', { name: 'Horas em' });

export const VIEW_ZONE_KEY = 'kurz.view-zone';
