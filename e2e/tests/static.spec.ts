import { expect, test } from '../support/fixtures.ts';

test('llms.txt describes the project for models', async ({ request }) => {
  const response = await request.get('/llms.txt');
  expect(response.status()).toBe(200);
  const text = await response.text();
  expect(text).toMatch(/^# Kurz/);
  expect(text).toContain('https://api.kurz.fyi/mcp');
  expect(text).toContain('## Optional');
});

test('robots.txt lets the blocked AI crawlers read only llms.txt', async ({ request }) => {
  const text = await (await request.get('/robots.txt')).text();
  for (const agent of ['GPTBot', 'ChatGPT-User', 'CCBot', 'anthropic-ai', 'Claude-Web']) {
    expect(text).toMatch(new RegExp(`User-agent: ${agent}\\nAllow: /llms.txt\\nDisallow: /`));
  }
});
