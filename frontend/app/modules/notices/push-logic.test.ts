import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bytesToUrlBase64,
  deviceState,
  urlBase64ToBytes,
} from './push-logic.ts';

const base = {
  serverEnabled: true,
  supported: true,
  ios: false,
  standalone: false,
  permission: 'default' as const,
  subscribed: false,
};

test('the server without keys wins over everything else', () => {
  assert.equal(
    deviceState({
      ...base,
      serverEnabled: false,
      permission: 'granted',
      subscribed: true,
    }),
    'server_off'
  );
});

test('on iOS push only works from the home screen, so that is asked first', () => {
  assert.equal(
    deviceState({ ...base, ios: true, supported: false }),
    'ios_install'
  );
  assert.equal(deviceState({ ...base, ios: true, standalone: true }), 'off');
});

test('a browser without push says so, and a blocked permission says that', () => {
  assert.equal(deviceState({ ...base, supported: false }), 'unsupported');
  assert.equal(deviceState({ ...base, permission: 'denied' }), 'denied');
});

test('on needs both the permission and a subscription', () => {
  assert.equal(
    deviceState({ ...base, permission: 'granted', subscribed: true }),
    'on'
  );
  assert.equal(
    deviceState({ ...base, permission: 'granted', subscribed: false }),
    'off'
  );
  assert.equal(deviceState(base), 'off');
});

test('bytes survive a round trip through the browser format, including the characters that differ from base64', () => {
  const bytes = Uint8Array.from([251, 255, 190, 0, 1, 2, 250, 63]);
  const text = bytesToUrlBase64(bytes.buffer as ArrayBuffer);
  assert.equal(/[+/=]/.test(text), false);
  assert.deepEqual([...urlBase64ToBytes(text)], [...bytes]);
  assert.equal(urlBase64ToBytes('AQID').join(','), '1,2,3');
});

test('nothing to encode gives an empty string', () => {
  assert.equal(bytesToUrlBase64(null), '');
});
