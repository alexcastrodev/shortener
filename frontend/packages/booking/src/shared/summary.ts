import {
  DAYS,
  TIME,
  type ScheduleValues,
  type ServiceValues,
} from './config.ts';

export type Day = (typeof DAYS)[number];

export type SummaryWords = {
  minutes: (count: number) => string;
  price: (amount: number, currency: string) => string;
  unlimited: string;
  places: (count: number) => string;
  also: (list: string) => string;
  monthly: (detail: string | null) => string;
  times: (count: number) => string;
  ownTimes: (days: string) => string;
  day: (day: Day) => string;
};

export function dayList(days: readonly string[], label: (day: Day) => string) {
  const runs: Day[][] = [];
  for (const day of DAYS.filter(item => days.includes(item))) {
    const run = runs.at(-1);
    if (run && DAYS.indexOf(run[run.length - 1]) === DAYS.indexOf(day) - 1) {
      run.push(day);
    } else {
      runs.push([day]);
    }
  }
  return runs
    .flatMap(run =>
      run.length >= 3
        ? [`${label(run[0])}–${label(run[run.length - 1])}`]
        : run.map(label)
    )
    .join(', ');
}

export function serviceProblem(
  schedule: ScheduleValues
): 'days' | 'times' | null {
  if (schedule.days.length === 0) return 'days';
  if (!schedule.times.some(time => TIME.test(time.value))) return 'times';
  return null;
}

const joined = (parts: (string | null)[]) =>
  parts.filter((part): part is string => Boolean(part)).join(' · ');

export function serviceSummary(service: ServiceValues, words: SummaryWords) {
  const { price, currency, monthlyPrice, monthlyDuration } = service;
  const extras = service.extraDurations
    .filter(item => item.duration !== '')
    .map(item =>
      joined([
        words.minutes(Number(item.duration)),
        price === '' || item.price === ''
          ? null
          : words.price(item.price, currency),
      ]).replace(' · ', ' ')
    );
  const details = joined([
    service.duration === '' ? null : words.minutes(service.duration),
    price === '' ? null : words.price(price, currency),
    extras.length ? words.also(extras.join(', ')) : null,
    service.capacity === '' ? words.unlimited : words.places(service.capacity),
    service.monthly
      ? words.monthly(
          [
            monthlyDuration === '' ? null : words.minutes(monthlyDuration),
            price !== '' && monthlyPrice !== ''
              ? words.price(monthlyPrice, currency)
              : null,
          ]
            .filter(Boolean)
            .join(' ') || null
        )
      : null,
  ]);
  return { details, schedule: scheduleSummary(service, words) };
}

export function scheduleSummary(
  schedule: ScheduleValues,
  words: Pick<SummaryWords, 'times' | 'ownTimes' | 'day'>
) {
  const times = new Set(
    schedule.times.map(time => time.value).filter(value => TIME.test(value))
  ).size;
  const own = DAYS.filter(
    day => schedule.days.includes(day) && schedule.byDay[day] !== undefined
  );
  return joined([
    dayList(schedule.days, words.day),
    words.times(times),
    own.length > 0 ? words.ownTimes(dayList(own, words.day)) : null,
  ]);
}
