export type TextPart = { text: string; href?: string };

const URL_PATTERN = /https?:\/\/[^\s<>"'`/][^\s<>"'`]*/gi;
const TRAILING = /[.,;:!?'"”’»]+$/;
const PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

function trimEnd(candidate: string): string {
  let url = candidate;
  for (;;) {
    const stripped = url.replace(TRAILING, '');
    if (stripped !== url) {
      url = stripped;
      continue;
    }
    const last = url.at(-1);
    const open = last ? PAIRS[last] : undefined;
    if (!open) return url;
    const opened = url.split(open).length - 1;
    const closed = url.split(last as string).length - 1;
    if (closed <= opened) return url;
    url = url.slice(0, -1);
  }
}

function safeHref(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const web = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    return web && parsed.hostname ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;
  const push = (value: string, href?: string) => {
    if (value) parts.push(href ? { text: value, href } : { text: value });
  };
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const url = trimEnd(match[0]);
    const href = safeHref(url);
    if (!href) continue;
    push(text.slice(cursor, start));
    push(url, href);
    cursor = start + url.length;
  }
  push(text.slice(cursor));
  return parts;
}
