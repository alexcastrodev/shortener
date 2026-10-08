import type { BookingAnswer, BookingService } from '@internal/core/types/Form';
import { monthlyDates } from './monthly-booking.ts';

export type BookingSummary = {
  kind: 'days' | 'monthly';
  sessions: { date: string; time: string }[];
  count: number;
  total: number | null;
  currency: string | null;
};

export function paidSessions(
  bundle: BookingService['bundle'],
  count: number
): number {
  return bundle
    ? Math.floor(count / bundle.take) * bundle.pay + (count % bundle.take)
    : count;
}

export function summarize(
  service: BookingService | undefined,
  answer: BookingAnswer | undefined,
  today: Date
): BookingSummary | null {
  if (!service || !answer) return null;
  const currency = service.currency || null;

  if (answer.monthly) {
    const { month, weekdays, time } = answer.monthly;
    const sessions = monthlyDates(month, weekdays, today).map(date => ({
      date,
      time,
    }));
    const price = service.monthly?.price;
    return {
      kind: 'monthly',
      sessions,
      count: sessions.length,
      total: price && currency ? price : null,
      currency,
    };
  }

  if (answer.sessions.length === 0) return null;
  const count = answer.sessions.length;
  const total =
    service.price && currency
      ? Math.round(
          service.price * paidSessions(service.bundle, count) * 100
        ) / 100
      : null;
  return { kind: 'days', sessions: answer.sessions, count, total, currency };
}
