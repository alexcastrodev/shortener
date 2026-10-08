import { test as base, expect, type Page } from '@playwright/test';
import { signInAs, type Role } from './auth.ts';
import { deleteCreatedForms } from './forms.ts';
import { clearMailbox } from './mail.ts';
import { flushCache } from './redis.ts';

type Fixtures = {
  cacheReset: void;
  mailboxReset: void;
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
  mailboxReset: [
    async ({}, use) => {
      await clearMailbox();
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
