import type { APIRequestContext } from '@playwright/test';
import { API_URL } from '../support/env.ts';
import { expect, test } from '../support/fixtures.ts';
import { createForm, service, uniqueTitle } from '../support/forms.ts';
import { one, parseHead, type Head } from '../support/head.ts';
import { owner } from '../support/api.ts';

const PT = { 'Accept-Language': 'pt-PT' };
const DEFAULT_IMAGE = 'https://kurz.fyi/og.png';

async function rawHead(request: APIRequestContext, publicId: string, headers: Record<string, string> = {}) {
  const response = await request.get(`/f/${publicId}`, { headers });
  expect(response.status()).toBe(200);
  return parseHead(await response.text());
}

function expectGenericHead(head: Head) {
  expect(head.title).toBe('Form - Kurz');
  expect(head.tags.get('robots')).toContain('noindex, nofollow');
  for (const key of ['og:title', 'og:description', 'og:url', 'og:image', 'twitter:card', 'twitter:image', 'description']) {
    expect(head.tags.has(key), key).toBe(false);
  }
}

test('a form with a cover is shared with its own title, intro text and cover', async ({ request, playwright }) => {
  const title = `${uniqueTitle('Ioga')} & "Pilates" <b>`;
  const form = await createForm({
    title,
    description: 'Venha experimentar uma aula.',
    cover: true,
    publish: true,
  });
  const head = await rawHead(request, form.publicId);

  expect(head.titles).toBe(1);
  expect(head.title).toBe(title);
  expect(one(head, 'og:title')).toBe(title);
  expect(one(head, 'twitter:title')).toBe(title);
  for (const key of ['description', 'og:description', 'twitter:description']) {
    expect(one(head, key)).toBe('Venha experimentar uma aula.');
  }
  expect(one(head, 'og:url')).toBe(`https://kurz.fyi/f/${form.publicId}`);
  expect(one(head, 'og:type')).toBe('website');
  expect(one(head, 'og:site_name')).toBe('Kurz');
  expect(one(head, 'twitter:card')).toBe('summary_large_image');
  expect(head.tags.get('robots')).toContain('noindex, nofollow');

  const cover = one(head, 'og:image');
  expect(cover).toMatch(new RegExp(`^${API_URL}/api/public/forms/${form.publicId}/cover/[A-Za-z0-9]+$`));
  expect(one(head, 'twitter:image')).toBe(cover);
  expect(one(head, 'og:image:alt')).toBe(title);
  expect(one(head, 'og:image:type')).toBe('image/webp');

  const crawler = await playwright.request.newContext();
  const image = await crawler.get(cover);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toBe('image/webp');
  expect((await image.body()).subarray(0, 4).toString()).toBe('RIFF');
  await crawler.dispose();
});

test('a form without a cover falls back to the Kurz image and to a text that depends on the form', async ({ request }) => {
  const form = await createForm({ publish: true });
  const head = await rawHead(request, form.publicId, PT);

  expect(one(head, 'og:image')).toBe(DEFAULT_IMAGE);
  expect(one(head, 'twitter:image')).toBe(DEFAULT_IMAGE);
  expect(one(head, 'twitter:card')).toBe('summary_large_image');
  expect(JSON.stringify([...head.tags])).not.toContain('/cover/');
  expect(one(head, 'og:title')).toBe(form.title);
  expect(one(head, 'description')).toBe(`Responda a ${form.title}`);
  expect(one(head, 'og:description')).toBe(`Responda a ${form.title}`);
  expect(one(head, 'twitter:description')).toBe(`Responda a ${form.title}`);

  const english = await rawHead(request, form.publicId, { 'Accept-Language': 'en-GB,en;q=0.8' });
  expect(one(english, 'og:description')).toBe(`Answer ${form.title}`);

  const saved = await rawHead(request, form.publicId, { Cookie: 'kurz_locale=pt-PT', 'Accept-Language': 'en' });
  expect(one(saved, 'og:description')).toBe(`Responda a ${form.title}`);
});

test('a form with a booking question and no intro text invites to book a time', async ({ request }) => {
  const form = await createForm({ services: [service('Sessão')], publish: true });
  const head = await rawHead(request, form.publicId, PT);
  expect(one(head, 'og:description')).toBe(`Marque o seu horário em ${form.title}`);
  expect(one(head, 'description')).toBe(`Marque o seu horário em ${form.title}`);

  const english = await rawHead(request, form.publicId);
  expect(one(english, 'og:description')).toBe(`Book a time at ${form.title}`);
});

test('a long intro text with line breaks becomes one short line cut at a word', async ({ request }) => {
  const description = [
    'Reserve em https://exemplo.pt/ioga/aulas?turma=manha&nivel=2 hoje.',
    '',
    'Aulas de ioga para todos os níveis,\r\nem pequenos grupos, no centro da cidade.',
    ...Array.from({ length: 30 }, (_, i) => `palavra${i}`),
  ].join('\n');
  const form = await createForm({ description, publish: true });
  const head = await rawHead(request, form.publicId);
  const flat = description.replace(/\s+/g, ' ').trim();

  const shown = one(head, 'og:description');
  expect(shown).not.toMatch(/[\r\n]/);
  expect(shown.length).toBeLessThanOrEqual(160);
  expect(shown.length).toBeGreaterThan(100);
  expect(shown.endsWith('…')).toBe(true);
  expect(shown).toContain('https://exemplo.pt/ioga/aulas?turma=manha&nivel=2 hoje.');
  const kept = shown.slice(0, -1);
  expect(flat.startsWith(kept)).toBe(true);
  expect(flat[kept.length]).toBe(' ');
  expect(one(head, 'description')).toBe(shown);
  expect(one(head, 'twitter:description')).toBe(shown);
});

test('a form that is not public keeps the generic head', async ({ request }) => {
  expectGenericHead(await rawHead(request, 'doesNotExist'));

  const draft = await createForm({ description: 'Segredo do rascunho', cover: true });
  const draftHead = await rawHead(request, draft.publicId);
  expectGenericHead(draftHead);
  expect(JSON.stringify([...draftHead.tags])).not.toContain('Segredo');

  const published = await createForm({ publish: true });
  await owner.post(`/api/me/forms/${published.id}/unpublish`);
  expectGenericHead(await rawHead(request, published.publicId));
});

test('an unknown form still shows the not found page and a published one still hydrates', async ({ page }) => {
  await page.goto('/f/doesNotExist');
  await expect(page.getByRole('heading', { name: 'Formulário não encontrado' })).toBeVisible();
  await expect(page).toHaveTitle('Form - Kurz');

  const form = await createForm({ description: 'Venha experimentar.', services: [service('Sessão')], publish: true });
  await page.goto(`/f/${form.publicId}`);
  await expect(page.getByRole('heading', { level: 1, name: form.title })).toBeVisible();
  await expect(page.getByText('Escolha um horário')).toBeVisible();
  await expect(page).toHaveTitle(form.title);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', 'Venha experimentar.');
});

test('the server asks the API on behalf of the visitor, not of the front end', async ({ request }) => {
  test.skip(!process.env.SSR_FORWARD_SECRET, 'needs SSR_FORWARD_SECRET on both servers');
  const form = await createForm({ description: 'Intro', publish: true });
  const crowd = { 'CF-Connecting-IP': '198.51.100.10' };

  for (let i = 0; i < 120; i++) {
    expect((await request.get(`/f/${form.publicId}`, { headers: crowd })).status()).toBe(200);
  }
  expect(one(await rawHead(request, form.publicId, { 'CF-Connecting-IP': '198.51.100.11' }), 'og:description')).toBe('Intro');
  expectGenericHead(await rawHead(request, form.publicId, crowd));
});
