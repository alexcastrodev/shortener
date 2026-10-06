import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicCoverUrl } from './form-cover-url.ts';

test('the public cover address is built from the form and the token', () => {
  assert.equal(
    publicCoverUrl('Abc123', 'tok', 'https://api.example'),
    'https://api.example/api/public/forms/Abc123/cover/tok'
  );
});

test('no token means no cover', () => {
  assert.equal(publicCoverUrl('Abc123', null, 'https://api.example'), null);
  assert.equal(publicCoverUrl('Abc123', undefined, ''), null);
});

test('the parts of the address are escaped', () => {
  assert.equal(
    publicCoverUrl('a/b', 'c d', ''),
    '/api/public/forms/a%2Fb/cover/c%20d'
  );
});
