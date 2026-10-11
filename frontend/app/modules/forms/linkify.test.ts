import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitLinks } from './linkify.ts';

const links = (text: string) =>
  splitLinks(text).filter(part => part.href).map(part => part.href);

test('plain text stays one part with no link', () => {
  assert.deepEqual(splitLinks('Obrigado pela marcação.'), [
    { text: 'Obrigado pela marcação.' },
  ]);
  assert.deepEqual(splitLinks(''), []);
});

test('a link that starts with http or https becomes a link, the text around it is kept', () => {
  assert.deepEqual(splitLinks('Veja https://kurz.fyi/ana agora'), [
    { text: 'Veja ' },
    { text: 'https://kurz.fyi/ana', href: 'https://kurz.fyi/ana' },
    { text: ' agora' },
  ]);
  assert.deepEqual(links('http://exemplo.pt'), ['http://exemplo.pt/']);
  assert.deepEqual(links('HTTPS://Exemplo.pt/A'), ['https://exemplo.pt/A']);
});

test('text that starts with the link, and several links, are all found', () => {
  assert.deepEqual(splitLinks('https://a.pt')[0], {
    text: 'https://a.pt',
    href: 'https://a.pt/',
  });
  assert.deepEqual(links('um https://a.pt e http://b.pt/x?y=1#z fim'), [
    'https://a.pt/',
    'http://b.pt/x?y=1#z',
  ]);
});

test('the punctuation that ends a sentence is not part of the link', () => {
  assert.deepEqual(splitLinks('Siga https://a.pt/p.'), [
    { text: 'Siga ' },
    { text: 'https://a.pt/p', href: 'https://a.pt/p' },
    { text: '.' },
  ]);
  assert.deepEqual(links('(veja https://a.pt/p), ou https://b.pt!'), [
    'https://a.pt/p',
    'https://b.pt/',
  ]);
  assert.deepEqual(links('"https://a.pt/p"'), ['https://a.pt/p']);
});

test('a closing parenthesis stays when the link opens one', () => {
  assert.deepEqual(links('https://pt.wikipedia.org/wiki/Kurz_(cidade)'), [
    'https://pt.wikipedia.org/wiki/Kurz_(cidade)',
  ]);
});

test('line breaks around a link are kept in the text parts', () => {
  assert.deepEqual(splitLinks('Linha 1\nhttps://a.pt\nLinha 3'), [
    { text: 'Linha 1\n' },
    { text: 'https://a.pt', href: 'https://a.pt/' },
    { text: '\nLinha 3' },
  ]);
});

test('only http and https are links, and a bare scheme is not', () => {
  assert.deepEqual(links('javascript:alert(1) data:text/html,x ftp://a.pt'), []);
  assert.deepEqual(links('https:// e http:///x'), []);
  assert.deepEqual(links('www.exemplo.pt exemplo.pt'), []);
  assert.deepEqual(links('xhttps://a.pt'), ['https://a.pt/']);
});

test('markup in the text is kept as plain text, never as markup', () => {
  const text = '<img src=x onerror=alert(1)> <b>https://b.pt</b>';
  const parts = splitLinks(text);
  assert.equal(parts.map(part => part.text).join(''), text);
  assert.ok(parts.every(part => !part.href || part.href.startsWith('https://')));
});
