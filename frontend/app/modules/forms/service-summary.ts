import { DAYS, TIME, type ServiceValues } from './booking-config.ts';

export type Day = (typeof DAYS)[number];

export type SummaryWords = {
  minutes: (count: number) => string;
  price: (amount: number, currency: string) => string;
  unlimited: string;
  places: (count: number) => string;
  bundle: (take: number, pay: number) => string;
  monthly: (price: string | null) => string;
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
  service: ServiceValues
): 'days' | 'times' | null {
  if (service.days.length === 0) return 'days';
  if (!service.times.some(time => TIME.test(time.value))) return 'times';
  return null;
}

const joined = (parts: (string | null)[]) =>
  parts.filter((part): part is string => Boolean(part)).join(' · ');

export function serviceSummary(service: ServiceValues, words: SummaryWords) {
  const { price, currency, bundleTake, bundlePay, monthlyPrice } = service;
  const details = joined([
    service.duration === '' ? null : words.minutes(service.duration),
    price === '' ? null : words.price(price, currency),
    service.capacity === '' ? words.unlimited : words.places(service.capacity),
    service.bundle && bundleTake !== '' && bundlePay !== ''
      ? words.bundle(bundleTake, bundlePay)
      : null,
    service.monthly
      ? words.monthly(
          price !== '' && monthlyPrice !== ''
            ? words.price(monthlyPrice, currency)
            : null
        )
      : null,
  ]);
  const times = new Set(
    service.times.map(time => time.value).filter(value => TIME.test(value))
  ).size;
  const own = DAYS.filter(
    day => service.days.includes(day) && service.byDay[day] !== undefined
  );
  const schedule = joined([
    dayList(service.days, words.day),
    words.times(times),
    own.length > 0 ? words.ownTimes(dayList(own, words.day)) : null,
  ]);
  return { details, schedule };
}
