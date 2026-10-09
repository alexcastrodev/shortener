import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localeToSave, resolveLocale, readCookie } from './locales.ts';

test('an account without a saved language gets the one the app is showing', () => {
  assert.equal(localeToSave(null, 'pt-PT'), 'pt-PT');
  assert.equal(localeToSave(undefined, 'en'), 'en');
  assert.equal(localeToSave('fr', 'pt-PT'), 'pt-PT');
});

test('a saved language is never overwritten, and only supported languages are saved', () => {
  assert.equal(localeToSave('en', 'pt-PT'), null);
  assert.equal(localeToSave('pt-PT', 'en'), null);
  assert.equal(localeToSave(null, 'pt'), null);
  assert.equal(localeToSave(null, 'de'), null);
});

test('cookie wins over preference and Accept-Language', () => {
  assert.equal(
    resolveLocale({ cookie: 'pt-PT', preference: 'en', acceptLanguage: 'en' }),
    'pt-PT',
  );
});

test('preference wins over Accept-Language', () => {
  assert.equal(resolveLocale({ preference: 'pt-PT', acceptLanguage: 'en' }), 'pt-PT');
});

test('Accept-Language honours q and maps pt variants to pt-PT', () => {
  assert.equal(resolveLocale({ acceptLanguage: 'fr;q=0.9, pt-BR;q=0.8, en;q=0.5' }), 'pt-PT');
  assert.equal(resolveLocale({ acceptLanguage: 'pt;q=0.2, en-GB;q=0.9' }), 'en');
});

test('unknown or invalid input falls back to en', () => {
  assert.equal(resolveLocale({ cookie: 'xx', preference: 'yy', acceptLanguage: 'fr, de' }), 'en');
  assert.equal(resolveLocale({ acceptLanguage: 'pt;q=abc' }), 'en');
  assert.equal(resolveLocale({}), 'en');
});

test('readCookie extracts the locale cookie', () => {
  assert.equal(readCookie('a=1; kurz_locale=pt-PT; b=2'), 'pt-PT');
  assert.equal(readCookie('a=1'), null);
});
