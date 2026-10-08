import { readFileSync } from 'node:fs';
import type { BrowserContext } from '@playwright/test';
import { TOKENS_FILE } from './env.ts';

export type Role = 'owner' | 'client' | 'waiter';

export const accounts: Record<Role, string> = {
  owner: 'owner-e2e@example.test',
  client: 'client-e2e@example.test',
  waiter: 'waiter-e2e@example.test',
};

export const tokenFor = (role: Role): string =>
  (JSON.parse(readFileSync(TOKENS_FILE, 'utf8')) as Record<Role, string>)[role];

export async function signInAs(context: BrowserContext, role: Role) {
  await context.addCookies([
    {
      name: 'kurz_session',
      value: tokenFor(role),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);
}
