import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicForm } from '@internal/core/types/Form';
import { DESCRIPTION_MAX, clipAtWord, formMeta, type FormMetaText } from './form-meta.ts';

const t: FormMetaText = (key, { title }) =>
  key === 'meta_booking' ? `Marque o seu horário em ${title}` : `Responda a ${title}`;

const API = 'https://api.kurz.fyi';

const form = (overrides: Partial<PublicForm> = {}): PublicForm => ({
  title: 'Aulas de ioga',
  description: null,
  thank_you_message: null,
  theme: 'default' as PublicForm['theme'],
  layout: 'page',
  fields: [{ id: 'a1', type: 'short_text', label: 'Nome' }],
  cover_token: null,
  cover_position: 50,
  ...overrides,
});

type Tag = Record<string, string>;

const build = (value: PublicForm | null | undefined, publicId = 'Abc123XyZ0') =>
  formMeta({ form: value, publicId, apiBase: API, t }) as Tag[];

const content = (tags: Tag[], key: 'name' | 'property', name: string) =>
  tags.filter(tag => tag[key] === name).map(tag => tag.content);

const only = (tags: Tag[], key: 'name' | 'property', name: string) => {
  const found = content(tags, key, name);
  assert.equal(found.length, 1, `${name} appears ${found.length} times`);
  return found[0];
};

test('no form keeps the generic title and stays out of search engines', () => {
  for (const missing of [null, undefined]) {
    assert.deepEqual(build(missing), [
      { title: 'Form - Kurz' },
      { name: 'robots', content: 'noindex, nofollow' },
    ]);
  }
});

test('a form without a title keeps the generic meta', () => {
  assert.equal(build(form({ title: '   ' }))[0].title, 'Form - Kurz');
});

test('the title and the intro text come from the form', () => {
  const tags = build(form({ description: 'Venha experimentar uma aula.' }));
  assert.equal(tags[0].title, 'Aulas de ioga');
  assert.equal(only(tags, 'property', 'og:title'), 'Aulas de ioga');
  assert.equal(only(tags, 'name', 'twitter:title'), 'Aulas de ioga');
  for (const [key, name] of [
    ['name', 'description'],
    ['property', 'og:description'],
    ['name', 'twitter:description'],
  ] as const) {
    assert.equal(only(tags, key, name), 'Venha experimentar uma aula.');
  }
});

test('the address is absolute and canonical', () => {
  assert.equal(only(build(form()), 'property', 'og:url'), 'https://kurz.fyi/f/Abc123XyZ0');
});

test('robots stays noindex', () => {
  assert.equal(only(build(form()), 'name', 'robots'), 'noindex, nofollow');
});

test('line breaks and repeated spaces become single spaces and links stay as text', () => {
  const tags = build(
    form({ description: '  Reserve já\r\n\r\nem https://exemplo.pt/ioga?x=1  \n\t obrigado ' })
  );
  assert.equal(only(tags, 'name', 'description'), 'Reserve já em https://exemplo.pt/ioga?x=1 obrigado');
});

test('a long text is cut at a word with an ellipsis and never passes the limit', () => {
  const words = Array.from({ length: 80 }, (_, i) => `palavra${i}`).join(' ');
  const description = only(build(form({ description: words })), 'name', 'description');
  assert.ok(description.length <= DESCRIPTION_MAX, `${description.length} characters`);
  assert.ok(description.endsWith('…'));
  assert.ok(words.startsWith(description.slice(0, -1)));
  assert.match(words.slice(description.length - 1), /^ /);
});

test('a link is never split in the middle', () => {
  const link = 'https://exemplo.pt/um/caminho/muito/comprido/que/nao/cabe';
  const description = `${'a'.repeat(DESCRIPTION_MAX - 20)} ${link}`;
  const clipped = clipAtWord(description);
  assert.ok(clipped.endsWith('…'));
  assert.ok(!clipped.includes('https://'));
});

test('a text of one single huge word is cut at the limit', () => {
  const clipped = clipAtWord('x'.repeat(500));
  assert.equal(clipped.length, DESCRIPTION_MAX);
  assert.ok(clipped.endsWith('…'));
});

test('the cut never leaves half an emoji', () => {
  const clipped = clipAtWord('😀'.repeat(200));
  assert.ok(clipped.endsWith('…'));
  assert.ok(!/[\uD800-\uDBFF]…$/.test(clipped));
  assert.ok(clipped.length <= DESCRIPTION_MAX);
});

test('a text that fits is left alone', () => {
  const exact = 'a '.repeat(DESCRIPTION_MAX / 2 - 1).trim();
  assert.equal(clipAtWord(exact), exact);
});

test('without an intro text a booking form invites to book', () => {
  const booking = form({
    fields: [
      { id: 'a1', type: 'short_text', label: 'Nome' },
      { id: 'b2', type: 'booking', label: 'Escolha um horário' },
    ],
  });
  for (const empty of [null, '', '  \n ']) {
    const tags = build({ ...booking, description: empty });
    assert.equal(only(tags, 'name', 'description'), 'Marque o seu horário em Aulas de ioga');
    assert.equal(only(tags, 'property', 'og:description'), 'Marque o seu horário em Aulas de ioga');
  }
});

test('without an intro text any other form invites to answer', () => {
  assert.equal(only(build(form()), 'name', 'description'), 'Responda a Aulas de ioga');
});

test('the fallback text is asked from the translator with the form title', () => {
  const asked: string[] = [];
  const tags = formMeta({
    form: form(),
    publicId: 'Abc123XyZ0',
    apiBase: API,
    t: (key, options) => {
      asked.push(`${key}:${options.title}`);
      return 'x';
    },
  });
  assert.deepEqual(asked, ['meta_answer:Aulas de ioga']);
  assert.ok(tags.length > 0);
});

test('a form with a cover uses it as a large absolute image', () => {
  const tags = build(form({ cover_token: 'tok123' }));
  const image = 'https://api.kurz.fyi/api/public/forms/Abc123XyZ0/cover/tok123';
  assert.equal(only(tags, 'property', 'og:image'), image);
  assert.equal(only(tags, 'name', 'twitter:image'), image);
  assert.equal(only(tags, 'property', 'og:image:type'), 'image/webp');
  assert.equal(only(tags, 'name', 'twitter:card'), 'summary_large_image');
  assert.equal(only(tags, 'property', 'og:image:alt'), 'Aulas de ioga');
  assert.equal(only(tags, 'name', 'twitter:image:alt'), 'Aulas de ioga');
});

test('a cover is made absolute even when the API address is relative', () => {
  const tags = formMeta({
    form: form({ cover_token: 'tok123' }),
    publicId: 'Abc123XyZ0',
    apiBase: '',
    t,
  }) as Tag[];
  assert.equal(
    only(tags, 'property', 'og:image'),
    'https://kurz.fyi/api/public/forms/Abc123XyZ0/cover/tok123'
  );
});

test('a form without a cover falls back to the site image and never points at a cover', () => {
  const tags = build(form());
  assert.equal(only(tags, 'property', 'og:image'), 'https://kurz.fyi/og.png');
  assert.equal(only(tags, 'name', 'twitter:image'), 'https://kurz.fyi/og.png');
  assert.equal(only(tags, 'name', 'twitter:card'), 'summary_large_image');
  assert.ok(!JSON.stringify(tags).includes('/cover/'));
});

test('every tag has a single name and a value', () => {
  for (const tags of [build(form()), build(form({ cover_token: 'tok123' })), build(null)]) {
    for (const tag of tags) {
      if ('title' in tag) continue;
      assert.ok(tag.name || tag.property);
      assert.ok(tag.content);
    }
  }
});
