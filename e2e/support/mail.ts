import { expect } from '@playwright/test';
import { MAILPIT_URL } from './env.ts';

export type Mail = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
};

async function mailpit(path: string, init?: RequestInit) {
  const response = await fetch(MAILPIT_URL + path, init);
  if (!response.ok) throw new Error(`mailpit ${path} answered ${response.status}`);
  const body = await response.text();
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    return {};
  }
}

export async function clearMailbox() {
  await mailpit('/api/v1/messages', { method: 'DELETE' });
}

export async function mailsTo(address: string): Promise<Mail[]> {
  const found = await mailpit(`/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}&limit=50`);
  const mails: Mail[] = [];
  for (const summary of found.messages ?? []) {
    const full = await mailpit(`/api/v1/message/${summary.ID}`);
    mails.push({
      id: summary.ID,
      from: full.From?.Address ?? '',
      to: (full.To ?? []).map((entry: { Address: string }) => entry.Address),
      subject: full.Subject ?? '',
      text: full.Text ?? '',
      html: full.HTML ?? '',
    });
  }
  return mails;
}

export async function waitForMail(address: string, subject?: RegExp | string): Promise<Mail> {
  let found: Mail | undefined;
  let seen: string[] = [];
  try {
    await expect
      .poll(
        async () => {
          const mails = await mailsTo(address);
          seen = mails.map(mail => mail.subject);
          found = mails.find(mail =>
            subject === undefined
              ? true
              : typeof subject === 'string'
                ? mail.subject.includes(subject)
                : subject.test(mail.subject)
          );
          return found !== undefined;
        },
        { timeout: 30_000, intervals: [250, 500, 1_000] }
      )
      .toBe(true);
  } catch {
    throw new Error(`no e-mail to ${address} matching ${String(subject)}; the mailbox has: ${JSON.stringify(seen)}`);
  }
  return found!;
}

export async function subjectsTo(address: string): Promise<string[]> {
  return (await mailsTo(address)).map(mail => mail.subject);
}

export function linksIn(mail: Mail): string[] {
  return [...mail.text.matchAll(/https?:\/\/[^\s<>"')]+/g)].map(match => match[0]);
}

export function linkTo(mail: Mail, area: 'm' | 'v' | 'w'): string {
  const link = linksIn(mail).find(candidate => new RegExp(`/${area}/[^/\\s]+$`).test(candidate));
  if (!link) throw new Error(`no /${area}/ link in "${mail.subject}": ${linksIn(mail).join(' ')}`);
  return link;
}

export const pathOf = (link: string) => new URL(link).pathname;
