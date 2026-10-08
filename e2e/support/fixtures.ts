import { test as base, expect, type Page } from '@playwright/test';
import { signInAs, type Role } from './auth.ts';
import { deleteCreatedForms } from './forms.ts';
import { flushCache } from './redis.ts';

type Fixtures = {
  cacheReset: void;
  formCleanup: void;
  signIn: (role: Role) => Promise<Page>;
};

export const test = base.extend<Fixtures>({
  cacheReset: [
    async ({}, use) => {
      await flushCache();
      await use();
    },
    { auto: true },
  ],
  formCleanup: [
    async ({}, use) => {
      await use();
      await deleteCreatedForms();
    },
    { auto: true },
  ],
  signIn: async ({ context, page }, use) => {
    await use(async role => {
      await signInAs(context, role);
      return page;
    });
  },
});

export { expect };
