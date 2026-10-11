import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bookingOptions,
  cheapestPrice,
  durationText,
  endTime,
  hasSeveralDurations,
  monthlyMinutes,
  optionFor,
  type DurationWords,
} from './booking-options.ts';

const words: DurationWords = {
  minutes: count => `${count} min`,
  hours: count => `${count} h`,
  hoursMinutes: (hours, minutes) => `${hours} h ${minutes} min`,
};

const piano = {
  duration: 60,
  price: 40,
  extra_durations: [{ duration: 90, price: 55 }],
  monthly: { price: 120, duration: 45 },
};

test('the main duration comes first, then the others with their prices', () => {
  assert.deepEqual(bookingOptions(piano), [
    { duration: 60, price: 40 },
    { duration: 90, price: 55 },
  ]);
  assert.deepEqual(bookingOptions({ duration: 30 }), [
    { duration: 30, price: null },
  ]);
});

test('a duration repeated while the owner is still editing is offered once, with the price of the first', () => {
  const draft = {
    duration: 60,
    price: 60,
    extra_durations: [
      { duration: 30, price: 20 },
      { duration: 60, price: 60 },
      { duration: 30, price: 25 },
    ],
  };
  assert.deepEqual(bookingOptions(draft), [
    { duration: 60, price: 60 },
    { duration: 30, price: 20 },
  ]);
  assert.equal(
    hasSeveralDurations({ duration: 60, extra_durations: [{ duration: 60 }] }),
    false
  );
});

test('a service with no other duration reads as one option', () => {
  assert.equal(hasSeveralDurations(piano), true);
  assert.equal(hasSeveralDurations({ duration: 30, extra_durations: [] }), false);
  assert.equal(hasSeveralDurations({ duration: 30, extra_durations: null }), false);
});

test('an option is found by its minutes, the main one when none is given', () => {
  assert.equal(optionFor(piano, 90)?.price, 55);
  assert.equal(optionFor(piano, undefined)?.price, 40);
  assert.equal(optionFor(piano, 45), undefined);
});

test('the cheapest price is the lowest of every option, null without prices', () => {
  assert.equal(cheapestPrice(piano), 40);
  assert.equal(
    cheapestPrice({ duration: 60, price: 50, extra_durations: [{ duration: 30, price: 25 }] }),
    25
  );
  assert.equal(cheapestPrice({ duration: 60 }), null);
});

test('the monthly offer has its own duration, or the service one', () => {
  assert.equal(monthlyMinutes(piano), 45);
  assert.equal(monthlyMinutes({ duration: 60, monthly: { price: 10 } }), 60);
  assert.equal(monthlyMinutes({ duration: 60 }), 60);
});

test('durations read as minutes, whole hours, or hours and minutes', () => {
  assert.equal(durationText(45, words), '45 min');
  assert.equal(durationText(60, words), '1 h');
  assert.equal(durationText(90, words), '1 h 30 min');
  assert.equal(durationText(120, words), '2 h');
});

test('the end time adds the duration and wraps past midnight', () => {
  assert.equal(endTime('11:00', 90), '12:30');
  assert.equal(endTime('09:15', 45), '10:00');
  assert.equal(endTime('23:30', 60), '00:30');
});
