import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fieldTitle, hasLabel } from './field-title.ts';

const typeName = (type: string) => `type:${type}`;

test('a question with a label is titled by it, trimmed', () => {
  assert.equal(
    fieldTitle({ type: 'booking', label: '  When?  ' }, typeName),
    'When?'
  );
});

test('a question without a label is titled by the name of its type', () => {
  assert.equal(fieldTitle({ type: 'booking' }, typeName), 'type:booking');
  assert.equal(
    fieldTitle({ type: 'booking', label: null }, typeName),
    'type:booking'
  );
  assert.equal(
    fieldTitle({ type: 'booking', label: '   ' }, typeName),
    'type:booking'
  );
});

test('only a label with text counts as a label', () => {
  assert.equal(hasLabel({ label: 'When?' }), true);
  assert.equal(hasLabel({ label: '' }), false);
  assert.equal(hasLabel({ label: '  ' }), false);
  assert.equal(hasLabel({ label: null }), false);
  assert.equal(hasLabel({}), false);
});
