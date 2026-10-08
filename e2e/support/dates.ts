const pad = (value: number) => String(value).padStart(2, '0');

export const isoDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function nextWeekdays(count: number, startOffsetDays = 2): string[] {
  const days: string[] = [];
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  cursor.setDate(cursor.getDate() + startOffsetDays);
  while (days.length < count) {
    if (cursor.getDay() >= 1 && cursor.getDay() <= 5) days.push(isoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function firstOfNextMonth(): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setMonth(date.getMonth() + 1, 1);
  return isoDate(date);
}
