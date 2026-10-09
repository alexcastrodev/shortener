export const LOCALES = ['en', 'pt-PT'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'kurz_locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

function match(tag: string): Locale | null {
  const lower = tag.trim().toLowerCase();
  if (lower === 'pt' || lower.startsWith('pt-')) return 'pt-PT';
  if (lower === 'en' || lower.startsWith('en-')) return 'en';
  return null;
}

function fromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { tag, q: q ? Number(q.slice(2)) : 1 };
    })
    .filter((entry) => entry.tag && Number.isFinite(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const found = match(tag);
    if (found) return found;
  }
  return null;
}

export function readCookie(cookieHeader: string | null | undefined, name = LOCALE_COOKIE) {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(';')) {
    const [key, ...rest] = pair.split('=');
    if (key.trim() === name) return decodeURIComponent(rest.join('=').trim());
  }
  return null;
}

export function localeToSave(saved: string | null | undefined, showing: string, chosen?: string | null): Locale | null {
  if (isLocale(chosen)) return chosen === saved ? null : chosen;
  return !isLocale(saved) && isLocale(showing) ? showing : null;
}

export function resolveLocale(input: {
  cookie?: string | null;
  preference?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(input.cookie)) return input.cookie;
  if (isLocale(input.preference)) return input.preference;
  return fromAcceptLanguage(input.acceptLanguage) ?? DEFAULT_LOCALE;
}
