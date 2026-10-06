import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dateRangeProblem,
  emptyFilters,
  exportName,
  hasFilters,
  toFilters,
} from './appointment-filters.ts';

test('blank filters send nothing, and the search is trimmed', () => {
  assert.deepEqual(toFilters(emptyFilters), {});
  assert.deepEqual(
    toFilters({ status: 'pending', q: '  ana  ', from: '2026-11-01', to: '' }),
    { status: 'pending', q: 'ana', from: '2026-11-01' }
  );
  assert.deepEqual(toFilters({ ...emptyFilters, q: '   ' }), {});
});

test('it knows when a filter is on', () => {
  assert.equal(hasFilters(emptyFilters), false);
  assert.equal(hasFilters({ ...emptyFilters, status: 'confirmed' }), true);
});

test('an end before the start is a problem, an open end is not', () => {
  assert.equal(
    dateRangeProblem({ ...emptyFilters, from: '2026-11-05', to: '2026-11-02' }),
    true
  );
  assert.equal(
    dateRangeProblem({ ...emptyFilters, from: '2026-11-05', to: '2026-11-05' }),
    false
  );
  assert.equal(
    dateRangeProblem({ ...emptyFilters, from: '2026-11-05' }),
    false
  );
});

test('the download name is safe and carries the format', () => {
  assert.equal(
    exportName('Salon & Spa / Lisboa', 'csv'),
    'Salon-Spa-Lisboa-appointments.csv'
  );
  assert.equal(exportName(undefined, 'xlsx'), 'form-appointments.xlsx');
  assert.equal(exportName('???', 'csv'), 'form-appointments.csv');
});
