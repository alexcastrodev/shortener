import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ZONE_KEY,
  convertWall,
  distinct,
  groupByViewDay,
  instantOf,
  isZone,
  localToday,
  marginDays,
  offsetMinutes,
  partsIn,
  readZone,
  requestRange,
  saveZone,
  zoneChoices,
} from './zone-time.ts';

const LISBON = 'Europe/Lisbon';

test('an instant is read as the date and time of any zone', () => {
  const instant = '2026-10-14T22:30:00Z';
  assert.deepEqual(partsIn(instant, 'UTC'), { date: '2026-10-14', time: '22:30' });
  assert.deepEqual(partsIn(instant, LISBON), { date: '2026-10-14', time: '23:30' });
  assert.deepEqual(partsIn(instant, 'America/Sao_Paulo'), { date: '2026-10-14', time: '19:30' });
  assert.deepEqual(partsIn(instant, 'Asia/Tokyo'), { date: '2026-10-15', time: '07:30' });
});

test('a zone with a different date than the form puts a late time on the next day', () => {
  assert.deepEqual(
    convertWall({ date: '2026-10-14', time: '23:30' }, LISBON, 'Asia/Tokyo'),
    { date: '2026-10-15', time: '07:30' }
  );
  assert.deepEqual(
    convertWall({ date: '2026-10-15', time: '00:30' }, LISBON, 'America/Sao_Paulo'),
    { date: '2026-10-14', time: '20:30' }
  );
});

test('half-hour and quarter-hour offsets are kept', () => {
  assert.deepEqual(
    convertWall({ date: '2026-10-14', time: '17:30' }, LISBON, 'Asia/Kolkata'),
    { date: '2026-10-14', time: '22:00' }
  );
  assert.deepEqual(
    convertWall({ date: '2026-10-14', time: '23:30' }, LISBON, 'Asia/Kolkata'),
    { date: '2026-10-15', time: '04:00' }
  );
  assert.deepEqual(
    convertWall({ date: '2026-10-14', time: '17:00' }, LISBON, 'Asia/Kathmandu'),
    { date: '2026-10-14', time: '21:45' }
  );
});

test('the same zone, or a missing one, changes nothing', () => {
  const wall = { date: '2026-03-29', time: '01:30' };
  assert.deepEqual(convertWall(wall, LISBON, LISBON), wall);
  assert.deepEqual(convertWall(wall, undefined, 'Asia/Tokyo'), wall);
  assert.deepEqual(convertWall(wall, LISBON, undefined), wall);
});

test('the wall clock of a zone gives back the same instant across the daylight saving changes', () => {
  assert.equal(instantOf('2026-03-28', '23:30', LISBON).toISOString(), '2026-03-28T23:30:00.000Z');
  assert.equal(instantOf('2026-03-29', '00:30', LISBON).toISOString(), '2026-03-29T00:30:00.000Z');
  assert.equal(instantOf('2026-03-29', '02:30', LISBON).toISOString(), '2026-03-29T01:30:00.000Z');
  assert.equal(instantOf('2026-10-25', '00:30', LISBON).toISOString(), '2026-10-24T23:30:00.000Z');
  assert.equal(instantOf('2026-10-25', '02:30', LISBON).toISOString(), '2026-10-25T02:30:00.000Z');
  assert.equal(instantOf('2026-11-01', '00:30', 'America/New_York').toISOString(), '2026-11-01T04:30:00.000Z');
  assert.equal(instantOf('2026-11-01', '03:30', 'America/New_York').toISOString(), '2026-11-01T08:30:00.000Z');
});

test('a time that happens twice is the first one, like the server', () => {
  assert.equal(instantOf('2026-10-25', '01:30', LISBON).toISOString(), '2026-10-25T00:30:00.000Z');
  assert.equal(instantOf('2026-11-01', '01:30', 'America/New_York').toISOString(), '2026-11-01T05:30:00.000Z');
});

test('a time that does not exist still gives an instant', () => {
  assert.equal(instantOf('2026-03-29', '01:30', LISBON).toISOString(), '2026-03-29T01:30:00.000Z');
});

test('a booking on the day the form clock changes is shown with the offset of that day', () => {
  assert.deepEqual(
    convertWall({ date: '2026-03-29', time: '09:00' }, LISBON, 'America/Sao_Paulo'),
    { date: '2026-03-29', time: '05:00' }
  );
  assert.deepEqual(
    convertWall({ date: '2026-03-28', time: '09:00' }, LISBON, 'America/Sao_Paulo'),
    { date: '2026-03-28', time: '06:00' }
  );
  assert.deepEqual(
    convertWall({ date: '2026-10-25', time: '09:00' }, LISBON, 'America/New_York'),
    { date: '2026-10-25', time: '05:00' }
  );
});

test('the converted time can go back to the form zone', () => {
  for (const zone of ['Asia/Tokyo', 'America/Sao_Paulo', 'Asia/Kolkata', 'Pacific/Kiritimati', 'UTC']) {
    const wall = { date: '2026-10-14', time: '23:30' };
    assert.deepEqual(convertWall(convertWall(wall, LISBON, zone), zone, LISBON), wall);
  }
});

test('the offset of a zone follows the daylight saving', () => {
  assert.equal(offsetMinutes(LISBON, Date.parse('2026-07-01T12:00:00Z')), 60);
  assert.equal(offsetMinutes(LISBON, Date.parse('2026-12-01T12:00:00Z')), 0);
  assert.equal(offsetMinutes('Asia/Kolkata', Date.parse('2026-07-01T12:00:00Z')), 330);
});

test('today is the calendar day of the zone, not of the browser', () => {
  const now = new Date('2026-10-14T20:00:00Z');
  const tokyo = localToday('Asia/Tokyo', now);
  assert.deepEqual([tokyo.getFullYear(), tokyo.getMonth(), tokyo.getDate()], [2026, 9, 15]);
  const lisbon = localToday(LISBON, now);
  assert.deepEqual([lisbon.getFullYear(), lisbon.getMonth(), lisbon.getDate()], [2026, 9, 14]);
  assert.equal(localToday(undefined, now), now);
});

test('the same zone asks the server for exactly the month', () => {
  const range = { from: '2026-10-01', to: '2026-10-31' };
  assert.equal(requestRange(range, LISBON, LISBON), range);
  assert.equal(requestRange(range, undefined, 'Asia/Tokyo'), range);
  assert.equal(requestRange(range, LISBON, undefined), range);
});

test('another zone asks for a day more on both ends so the edge days are complete', () => {
  const range = { from: '2026-10-01', to: '2026-10-31' };
  assert.deepEqual(requestRange(range, LISBON, 'America/Sao_Paulo'), {
    from: '2026-09-30',
    to: '2026-11-01',
  });
  assert.deepEqual(requestRange(range, LISBON, 'Asia/Tokyo'), {
    from: '2026-09-30',
    to: '2026-11-01',
  });
  assert.deepEqual(requestRange({ from: '2026-12-01', to: '2026-12-31' }, LISBON, 'Asia/Kolkata'), {
    from: '2026-11-30',
    to: '2027-01-01',
  });
});

test('two zones with the same clock still ask for a day more', () => {
  assert.equal(marginDays(LISBON, 'Europe/London', { from: '2026-10-01', to: '2026-10-31' }), 1);
});

test('zones more than a day apart ask for two days more', () => {
  const range = { from: '2026-10-01', to: '2026-10-31' };
  assert.equal(marginDays('Pacific/Pago_Pago', 'Pacific/Kiritimati', range), 2);
  assert.deepEqual(requestRange(range, 'Pacific/Pago_Pago', 'Pacific/Kiritimati'), {
    from: '2026-09-29',
    to: '2026-11-02',
  });
});

const slot = (starts_at: string, date: string, time: string) => ({ starts_at, date, time });

test('a slot belongs to the day it has in the view zone', () => {
  const days = groupByViewDay(
    [
      slot('2026-10-14T16:30:00Z', '2026-10-14', '17:30'),
      slot('2026-10-14T18:30:00Z', '2026-10-14', '19:30'),
      slot('2026-10-14T22:30:00Z', '2026-10-14', '23:30'),
    ],
    LISBON,
    'Asia/Tokyo'
  );
  assert.deepEqual([...days.keys()], ['2026-10-15']);
  assert.deepEqual(
    days.get('2026-10-15')!.map(item => item.viewTime),
    ['01:30', '03:30', '07:30']
  );
  assert.deepEqual(
    days.get('2026-10-15')!.map(item => `${item.date} ${item.time}`),
    ['2026-10-14 17:30', '2026-10-14 19:30', '2026-10-14 23:30']
  );
});

test('a late slot moves to the next day and an early one to the day before', () => {
  const days = groupByViewDay(
    [
      slot('2026-10-14T16:30:00Z', '2026-10-14', '17:30'),
      slot('2026-10-14T22:30:00Z', '2026-10-14', '23:30'),
    ],
    LISBON,
    'Asia/Tokyo'
  );
  assert.deepEqual([...days.keys()], ['2026-10-15']);
  const west = groupByViewDay(
    [slot('2026-11-01T01:30:00Z', '2026-11-01', '01:30')],
    LISBON,
    'America/Sao_Paulo'
  );
  assert.deepEqual([...west.keys()], ['2026-10-31']);
  assert.equal(west.get('2026-10-31')![0].viewTime, '22:30');
  assert.equal(west.get('2026-10-31')![0].date, '2026-11-01');
});

test('the last day of the viewed month is complete with the extra day asked for', () => {
  const asked = requestRange({ from: '2026-10-01', to: '2026-10-31' }, LISBON, 'America/Sao_Paulo');
  assert.equal(asked.to, '2026-11-01');
  const slots = [
    slot('2026-10-31T21:30:00Z', '2026-10-31', '21:30'),
    slot('2026-11-01T01:30:00Z', '2026-11-01', '01:30'),
  ];
  const days = groupByViewDay(slots, LISBON, 'America/Sao_Paulo');
  assert.deepEqual(
    days.get('2026-10-31')!.map(item => item.viewTime),
    ['18:30', '22:30']
  );
});

test('the same zone keeps the day and the time of the form and does not touch the order', () => {
  const slots = [
    slot('2026-10-14T08:00:00Z', '2026-10-14', '09:00'),
    slot('2026-10-14T09:00:00Z', '2026-10-14', '10:00'),
    slot('2026-10-15T08:00:00Z', '2026-10-15', '09:00'),
  ];
  const days = groupByViewDay(slots, LISBON, LISBON);
  assert.deepEqual([...days.keys()], ['2026-10-14', '2026-10-15']);
  assert.deepEqual(days.get('2026-10-14')!.map(item => item.viewTime), ['09:00', '10:00']);
  assert.deepEqual(groupByViewDay(slots, undefined, undefined).get('2026-10-14')!.length, 2);
});

test('a slot that two requests brought is listed once', () => {
  const one = slot('2026-10-31T21:30:00Z', '2026-10-31', '21:30');
  const days = groupByViewDay([one, { ...one }], LISBON, 'America/Sao_Paulo');
  assert.equal(days.get('2026-10-31')!.length, 1);
  assert.deepEqual(distinct([one, { ...one }, slot('2026-11-01T01:30:00Z', '2026-11-01', '01:30')]).length, 2);
});

test('the choices start with the zone of the visitor, then the zone of the form, and list every zone once', () => {
  const all = ['America/Sao_Paulo', 'Asia/Tokyo', LISBON, 'UTC'];
  const choices = zoneChoices(LISBON, 'Asia/Tokyo', all);
  assert.deepEqual(choices.slice(0, 2), [
    { value: 'Asia/Tokyo', mine: true },
    { value: LISBON, mine: false },
  ]);
  assert.deepEqual(
    choices.map(choice => choice.value),
    ['Asia/Tokyo', LISBON, 'America/Sao_Paulo', 'UTC']
  );
});

test('a visitor in the zone of the form gets no zone of their own', () => {
  const choices = zoneChoices(LISBON, LISBON, ['Asia/Tokyo', LISBON]);
  assert.deepEqual(
    choices.map(choice => choice.value),
    [LISBON, 'Asia/Tokyo']
  );
  assert.ok(choices.every(choice => !choice.mine));
  assert.equal(zoneChoices(LISBON, undefined, []).length, 1);
});

const memory = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
};

test('the chosen zone is remembered and read back', () => {
  const storage = memory();
  assert.equal(readZone(storage), undefined);
  saveZone(storage, 'America/Sao_Paulo');
  assert.equal(storage.data[ZONE_KEY], 'America/Sao_Paulo');
  assert.equal(readZone(storage), 'America/Sao_Paulo');
});

test('a stored zone the browser does not know is ignored', () => {
  assert.equal(readZone(memory({ [ZONE_KEY]: 'Mars/Olympus' })), undefined);
  assert.equal(readZone(memory({ [ZONE_KEY]: '' })), undefined);
  assert.equal(isZone('Asia/Kolkata'), true);
  assert.equal(isZone('UTC'), true);
  assert.equal(isZone(undefined), false);
});

test('a browser without storage, or one that refuses it, does not break the choice', () => {
  const refusing = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
  };
  assert.equal(readZone(undefined), undefined);
  assert.equal(readZone(refusing), undefined);
  assert.doesNotThrow(() => saveZone(refusing, 'Asia/Tokyo'));
  assert.doesNotThrow(() => saveZone(undefined, 'Asia/Tokyo'));
});
