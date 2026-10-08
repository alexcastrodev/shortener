import { owner } from './api.ts';

export type ServiceInput = {
  name: string;
  duration?: number;
  capacity?: number | null;
  days?: string[];
  times?: string[];
  price?: number;
  currency?: string;
  monthly?: { price?: number };
  bundle?: { take: number; pay: number };
};

export type FormOptions = {
  title?: string;
  layout?: 'page' | 'one_at_a_time' | 'steps';
  name?: boolean;
  emails?: { label: string; required?: boolean }[];
  services?: ServiceInput[];
  rules?: Record<string, unknown>;
  publish?: boolean;
  accepting?: boolean;
  bookingRequired?: boolean;
};

export type CreatedForm = {
  id: number;
  publicId: string;
  title: string;
  bookingId: string;
  nameId: string | undefined;
  emailIds: string[];
  serviceIds: string[];
};

let counter = 0;

const createdIds: number[] = [];

export async function deleteCreatedForms() {
  for (const id of createdIds.splice(0)) await owner.delete(`/api/me/forms/${id}`);
}

export const uniqueTitle = (prefix = 'E2E') => `${prefix} ${Date.now().toString(36)}${counter++}`;

export const service = (name: string, overrides: Partial<ServiceInput> = {}): ServiceInput => ({
  name,
  duration: 30,
  capacity: 1,
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  times: ['09:00', '10:00'],
  ...overrides,
});

export async function createForm(options: FormOptions = {}): Promise<CreatedForm> {
  const title = options.title ?? uniqueTitle();
  const created = await owner.post('/api/me/forms', { title, layout: options.layout ?? 'page' });
  if (created.status !== 201) throw new Error(`createForm failed: ${created.status}`);
  const id: number = created.body.form.id;
  createdIds.push(id);

  if (options.name !== false) {
    await owner.post(`/api/me/forms/${id}/fields`, { type: 'short_text', label: 'Nome', required: true });
  }
  for (const email of options.emails ?? []) {
    await owner.post(`/api/me/forms/${id}/fields`, {
      type: 'email',
      label: email.label,
      required: email.required ?? false,
    });
  }
  if (options.services) {
    const booked = await owner.post(`/api/me/forms/${id}/fields`, {
      type: 'booking',
      label: 'Escolha um horário',
      services: options.services,
      ...(options.bookingRequired ? { required: true } : {}),
      ...(options.rules ? { rules: options.rules } : {}),
    });
    if (booked.status !== 201) throw new Error(`booking field failed: ${booked.status}`);
  }
  if (options.publish) {
    const published = await owner.post(`/api/me/forms/${id}/publish`);
    if (published.status !== 200) throw new Error(`publish failed: ${published.status}`);
  }
  if (options.accepting === false) {
    await owner.patch(`/api/me/forms/${id}`, { accepting_responses: false });
  }
  return describe(id, title);
}

export async function describe(id: number, title = ''): Promise<CreatedForm> {
  const { body } = await owner.get(`/api/me/forms/${id}`);
  const fields: any[] = body.form.fields;
  const booking = fields.find(field => field.type === 'booking');
  return {
    id,
    publicId: body.form.public_id,
    title: title || body.form.title,
    bookingId: booking?.id,
    nameId: fields.find(field => field.type === 'short_text')?.id,
    emailIds: fields.filter(field => field.type === 'email').map(field => field.id),
    serviceIds: (booking?.services ?? []).map((item: any) => item.id),
  };
}

export const ownerForm = async (id: number) => (await owner.get(`/api/me/forms/${id}`)).body.form;

export const republish = (id: number) => owner.post(`/api/me/forms/${id}/publish`);

export const appointmentsOf = async (id: number) =>
  (await owner.get(`/api/me/forms/${id}/appointments`)).body.appointments as any[];
