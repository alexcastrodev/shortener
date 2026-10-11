import type {
  BookingAnswer,
  BookingItem,
  BookingService,
  MonthlyChoice,
  MonthlyPlan,
} from '@internal/core/types/Form';
import { monthlyDates } from './monthly-booking.ts';

export const isPlan = (choice: MonthlyChoice): choice is MonthlyPlan =>
  'sessions' in choice;

export const monthlySessions = (
  choice: MonthlyChoice,
  today: Date
): { date: string; time: string }[] =>
  isPlan(choice)
    ? choice.sessions
    : monthlyDates(choice.month, choice.weekdays, today).map(date => ({
        date,
        time: choice.time,
      }));

export const itemsOf = (answer: BookingAnswer | undefined): BookingItem[] =>
  !answer ? [] : 'items' in answer ? answer.items : [answer];

export const answerFrom = (
  items: BookingItem[],
  multiple: boolean
): BookingAnswer | undefined =>
  items.length === 0 ? undefined : multiple ? { items } : items[0];

export const setItem = (items: BookingItem[], item: BookingItem) =>
  items.some(entry => entry.service === item.service)
    ? items.map(entry => (entry.service === item.service ? item : entry))
    : [...items, item];

export const dropItem = (items: BookingItem[], service: string) =>
  items.filter(entry => entry.service !== service);

export const isEmptyItem = (item: BookingItem) =>
  item.sessions.length === 0 &&
  (!item.monthly ||
    (isPlan(item.monthly) && item.monthly.sessions.length === 0));

export const incompleteServices = (
  services: BookingService[] | undefined,
  answer: BookingAnswer | undefined
): string[] =>
  itemsOf(answer)
    .filter(isEmptyItem)
    .map(item => services?.find(entry => entry.id === item.service)?.name ?? item.service);

const picked = (item: BookingItem) =>
  item.sessions.length === 0 && item.monthly && isPlan(item.monthly)
    ? item.monthly.sessions
    : item.sessions;

const times = (item: BookingItem) =>
  picked(item)
    .map(session => `${session.date} ${session.time}`)
    .join(', ');

export function answerText(
  answer: BookingAnswer,
  names: Map<string, string>
): string {
  if (!('items' in answer)) return times(answer);
  return answer.items
    .map(item => `${names.get(item.service) ?? item.service}: ${times(item)}`)
    .join('; ');
}
