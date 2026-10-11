import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_TIME_ZONE, timeZoneOptions } from './time-zones.ts';

test('the list has the default zone, UTC and the zones of the platform, sorted and without repeats', () => {
  const zones = timeZoneOptions();
  assert.equal(DEFAULT_TIME_ZONE, 'Europe/Lisbon');
  assert.ok(zones.includes('Europe/Lisbon'));
  assert.ok(zones.includes('America/Sao_Paulo'));
  assert.ok(zones.includes('UTC'));
  assert.equal(new Set(zones).size, zones.length);
  assert.deepEqual(zones, [...zones].sort((a, b) => a.localeCompare(b)));
});

test('the zone the user already has is always an option, even if the platform does not list it', () => {
  assert.ok(timeZoneOptions('Mars/Olympus').includes('Mars/Olympus'));
  assert.equal(
    timeZoneOptions('Europe/Lisbon').filter(zone => zone === 'Europe/Lisbon').length,
    1
  );
});
