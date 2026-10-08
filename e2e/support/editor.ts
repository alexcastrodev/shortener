import { expect, type Page } from '@playwright/test';
import { dayLabel } from './calendar.ts';

export class BookingEditor {
  constructor(readonly page: Page) {}

  get services() {
    return this.page.getByRole('region', { name: 'Serviços' });
  }

  get daysOff() {
    return this.page.getByRole('region', { name: 'Folgas e horários especiais' });
  }

  get rules() {
    return this.page.getByRole('region', { name: 'Como funcionam as marcações' });
  }

  get saveButton() {
    return this.page.getByRole('button', { name: 'Guardar marcação' });
  }

  get saved() {
    return this.page.getByText('Alterações guardadas').first();
  }

  get invalid() {
    return this.page.getByText('Há campos por corrigir. Veja as mensagens a vermelho.').first();
  }

  async open(formId: number) {
    await this.page.goto(`/app/forms/${formId}`);
    await this.page.getByRole('button', { name: /Marcação de serviço$/ }).click();
    await expect(this.saveButton).toBeVisible();
  }

  async save() {
    await this.saveButton.click();
  }

  async expand(section: 'daysOff' | 'rules') {
    await this[section].getByRole('button', { name: 'Editar' }).click();
    await expect(this[section].getByRole('button', { name: 'Fechar' })).toBeVisible();
  }

  serviceField(label: string, index = 0) {
    return this.services.getByRole('textbox', { name: label, exact: true }).nth(index);
  }

  async addService(name: string) {
    const before = await this.services.getByRole('textbox', { name: 'Nome do serviço' }).count();
    await this.services.getByRole('button', { name: 'Adicionar serviço' }).click();
    await expect(this.services.getByRole('textbox', { name: 'Nome do serviço' })).toHaveCount(before + 1);
    await this.serviceField('Nome do serviço', before).fill(name);
    return before;
  }
}

export const bookingOf = (form: any) => form.fields.find((field: any) => field.type === 'booking');

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function shortDate(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`);
  return `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

export type DayOffInput = {
  from: string;
  to?: string;
  special?: string;
  services?: string[];
  note?: string;
};

export async function addDayOff(editor: BookingEditor, input: DayOffInput) {
  const form = editor.daysOff;
  if (input.special) {
    await form.getByText('Horário especial', { exact: true }).click();
    await form.getByRole('textbox', { name: 'Horários desse dia' }).fill(input.special);
  }
  await form.getByRole('textbox', { name: 'Data', exact: true }).fill(input.from);
  if (input.to) await form.getByRole('textbox', { name: 'Até (opcional)' }).fill(input.to);
  for (const name of input.services ?? []) await form.getByText(name, { exact: true }).click();
  if (input.note) await form.getByRole('textbox', { name: 'Nota (só você vê)' }).fill(input.note);
  await form.getByRole('button', { name: 'Adicionar', exact: true }).click();
}

export async function showDay(page: Page, iso: string) {
  await expect(page.getByRole('button', { name: 'Mês seguinte' })).toBeVisible();
  const target = page.getByRole('button', { name: dayLabel(iso), exact: true });
  for (let step = 0; step < 3 && (await target.count()) === 0; step++) {
    await page.getByRole('button', { name: 'Mês seguinte' }).click();
  }
  return target;
}
