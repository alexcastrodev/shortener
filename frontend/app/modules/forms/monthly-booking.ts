export const WEEKDAYS = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const;

export const pad = (value: number) => String(value).padStart(2, '0');

export function monthOptions(today: Date): { value: string; date: Date }[] {
  return [0, 1].map(offset => {
    const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    return { value: `${date.getFullYear()}-${pad(date.getMonth() + 1)}`, date };
  });
}

export function monthlyDates(
  month: string,
  weekdays: string[],
  today: Date
): string[] {
  const [year, number] = month.split('-').map(Number);
  const first = new Date(year, number - 1, 1);
  const last = new Date(year, number, 0).getDate();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const dates: string[] = [];
  for (let day = 1; day <= last; day += 1) {
    const date = new Date(first.getFullYear(), first.getMonth(), day);
    if (date < start) continue;
    if (weekdays.includes(WEEKDAYS[(date.getDay() + 6) % 7])) {
      dates.push(
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(day)}`
      );
    }
  }
  return dates;
}

export function toggleWeekday(weekdays: string[], day: string): string[] {
  return weekdays.includes(day)
    ? weekdays.filter(item => item !== day)
    : WEEKDAYS.filter(item => item === day || weekdays.includes(item));
}

export function monthlyComplete(choice: {
  month: string;
  weekdays: string[];
  time: string;
}) {
  return (
    choice.month !== '' && choice.weekdays.length > 0 && choice.time !== ''
  );
}
