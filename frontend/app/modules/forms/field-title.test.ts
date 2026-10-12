import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fieldTitle, hasLabel, helpId, helpIdFor } from './field-title.ts';

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

test('the help of a question is the description of its input, only when there is help', () => {
  assert.equal(helpId('f-1'), 'f-1-help');
  assert.equal(helpIdFor({ help: 'Take your time' }, 'f-1'), 'f-1-help');
  assert.equal(helpIdFor({ help: '' }, 'f-1'), undefined);
  assert.equal(helpIdFor({ help: null }, 'f-1'), undefined);
  assert.equal(helpIdFor({}, 'f-1'), undefined);
});
