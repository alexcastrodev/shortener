const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

const decode = (text: string) =>
  text.replace(/&(?:#x([0-9a-f]+)|#(\d+)|(\w+));/gi, (whole, hex, dec, name) => {
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    if (dec) return String.fromCodePoint(Number(dec));
    return ENTITIES[name] ?? whole;
  });

export type Head = {
  title: string | null;
  titles: number;
  tags: Map<string, string[]>;
  canonical: string[];
};

export function parseHead(html: string): Head {
  const head = html.slice(0, html.search(/<\/head>/i));
  const titles = [...head.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)];
  const tags = new Map<string, string[]>();
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [name, decode(value)]),
    );
    const key = attrs.name ?? attrs.property;
    if (key === undefined || attrs.content === undefined) continue;
    tags.set(key, [...(tags.get(key) ?? []), attrs.content]);
  }
  const canonical = [...head.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/gi)].map(
    ([tag]) => decode(/href="([^"]*)"/.exec(tag)?.[1] ?? ''),
  );

  return { title: titles[0] ? decode(titles[0][1]) : null, titles: titles.length, tags, canonical };
}

export const one = (head: Head, key: string) => {
  const found = head.tags.get(key) ?? [];
  if (found.length !== 1) throw new Error(`${key} appears ${found.length} times in the head`);
  return found[0];
};
