import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { DEFAULT_LOCALE, LOCALES } from './locales.ts';

const here = import.meta.dirname;
const appDir = resolve(here, '..');
const packagesDir = resolve(here, '../../../packages');
const PLURAL = /_(zero|one|two|few|many|other)$/;

type Tree = { [key: string]: string | Tree };

function load(locale: string, namespace: string): Tree {
  return JSON.parse(readFileSync(join(here, locale, `${namespace}.json`), 'utf8'));
}

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') out.set(prefix + key, value);
    else for (const [k, v] of flatten(value, `${prefix}${key}.`)) out.set(k, v);
  }
  return out;
}

const base = (key: string) => key.replace(PLURAL, '');
const placeholders = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();
const namespaces = readdirSync(join(here, 'en')).map((file) => file.replace(/\.json$/, ''));

function sources(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name.endsWith('.test.ts')) return [];
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) ? [readFileSync(path, 'utf8')] : [];
  });
}

const translations = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

for (const locale of translations) {
  test(`${locale} has every namespace`, () => {
    const found = readdirSync(join(here, locale)).map((file) => file.replace(/\.json$/, ''));
    assert.deepEqual([...found].sort(), [...namespaces].sort());
  });
}

for (const namespace of namespaces) {
  for (const locale of translations) {
  test(`${locale} matches en in ${namespace}`, (t) => {
    const en = flatten(load(DEFAULT_LOCALE, namespace));
    const pt = flatten(load(locale, namespace));
    if (pt.size === 0) return t.skip('not translated yet');

    const enKeys = new Set([...en.keys()].map(base));
    const ptKeys = new Set([...pt.keys()].map(base));
    assert.deepEqual([...enKeys].filter((k) => !ptKeys.has(k)), [], 'missing in pt-PT');
    assert.deepEqual([...ptKeys].filter((k) => !enKeys.has(k)), [], 'extra in pt-PT');

    for (const [key, text] of pt) {
      const source = en.get(key);
      if (source === undefined) continue;
      assert.deepEqual(placeholders(text), placeholders(source), `placeholders differ in ${key}`);
    }
  });
  }

  test(`every en key of ${namespace} is used`, () => {
    const code = [...sources(appDir), ...sources(packagesDir)].join('\n');
    const unused = [...flatten(load(DEFAULT_LOCALE, namespace)).keys()]
      .map(base)
      .filter(
        (key) =>
          !['"', "'", '`'].some(
            (q) => code.includes(`${q}${key}${q}`) || code.includes(`${q}${namespace}:${key}${q}`),
          ),
      );
    assert.deepEqual([...new Set(unused)], []);
  });
}
