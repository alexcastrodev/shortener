import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import routes from '../routes.ts';
import { ROUTE_NAMESPACES, namespacesFor } from './namespaces.ts';

type Entry = { file: string; path?: string; children?: Entry[] };

const here = import.meta.dirname;
const appDir = resolve(here, '..');
const known = readdirSync(join(here, 'en')).map((file) => file.replace(/\.json$/, ''));
const quoted = (text: string) => [...text.matchAll(/'([^']*)'/g)].map((m) => m[1]);

function resolveImport(from: string, specifier: string) {
  const base = specifier.startsWith('~/') ? join(appDir, specifier.slice(2)) : resolve(dirname(from), specifier);
  return [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')].find(
    (path) => existsSync(path) && statSync(path).isFile() && /\.tsx?$/.test(path),
  );
}

function scan(file: string) {
  const code = readFileSync(file, 'utf8');
  const namespaces = new Set<string>();
  for (const m of code.matchAll(/useTranslation\(\s*(\[[^\]]*\]|'[^']*')?\s*\)/g)) {
    (m[1] ? quoted(m[1]) : ['menu']).forEach((ns) => namespaces.add(ns));
  }
  for (const m of code.matchAll(/(?:getFixedT\([^,)]*,|\bns:)\s*(\[[^\]]*\]|'[^']*')/g)) {
    quoted(m[1]).forEach((ns) => namespaces.add(ns));
  }
  for (const m of code.matchAll(/['"`]([A-Za-z]+):[a-z_]/g)) if (known.includes(m[1])) namespaces.add(m[1]);
  const imports = [...code.matchAll(/(?:from|import)\s*\(?\s*'((?:\.{1,2}|~)\/[^']+)'/g)]
    .map((m) => resolveImport(file, m[1]))
    .filter((path): path is string => !!path);
  return { namespaces, imports };
}

function used(entry: string) {
  const out = new Set<string>();
  const queue = [entry];
  const seen = new Set(queue);
  while (queue.length) {
    const { namespaces, imports } = scan(queue.pop()!);
    namespaces.forEach((ns) => out.add(ns));
    for (const next of imports) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return out;
}

function pages(entries: Entry[], parent: string, inherited: Set<string>, out = new Map<string, Set<string>>()) {
  for (const entry of entries) {
    const pattern = entry.path ? `${parent.replace(/\/$/, '')}/${entry.path}` : parent;
    const namespaces = new Set([...inherited, ...used(resolve(appDir, entry.file))]);
    if (entry.children?.length) pages(entry.children, pattern, namespaces, out);
    else out.set(pattern, new Set([...(out.get(pattern) ?? []), ...namespaces]));
  }
  return out;
}

const found = pages(routes as Entry[], '/', used(resolve(appDir, 'root.tsx')));

for (const [pattern, namespaces] of found) {
  test(`${pattern} declares the namespaces it uses`, () => {
    const expected = [...namespaces].sort();
    assert.deepEqual(
      [...namespacesFor(pattern)].sort(),
      expected,
      `set ROUTE_NAMESPACES['${pattern}'] in app/i18n/namespaces.ts to ${JSON.stringify(expected)}`,
    );
  });
}

test('every declared route exists', () => {
  assert.deepEqual(Object.keys(ROUTE_NAMESPACES).filter((pattern) => !found.has(pattern)), []);
});

test('the router pattern, with or without its leading slash, finds the route', () => {
  assert.deepEqual(namespacesFor('f/:publicId'), namespacesFor('/f/:publicId'));
  assert.deepEqual(namespacesFor('/no/such/page'), []);
});
