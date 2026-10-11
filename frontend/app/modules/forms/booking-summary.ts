import type { BookingAnswer, BookingService } from '@internal/core/types/Form';
import { monthlyMinutes, optionFor } from './booking-options.ts';
import { monthlyDates } from './monthly-booking.ts';

export type SummarySession = {
  date: string;
  time: string;
  duration: number;
  price: number | null;
};

export type BookingSummary = {
  kind: 'days' | 'monthly';
  sessions: SummarySession[];
  count: number;
  total: number | null;
  currency: string | null;
};

export function summarize(
  service: BookingService | undefined,
  answer: BookingAnswer | undefined,
  today: Date
): BookingSummary | null {
  if (!service || !answer) return null;
  const currency = service.currency || null;

  if (answer.monthly) {
    const { month, weekdays, time } = answer.monthly;
    const duration = monthlyMinutes(service);
    const sessions = monthlyDates(month, weekdays, today).map(date => ({
      date,
      time,
      duration,
      price: null,
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
  const sessions = answer.sessions.map(session => {
    const option = optionFor(service, session.duration);
    return {
      date: session.date,
      time: session.time,
      duration: option?.duration ?? service.duration,
      price: option?.price ?? null,
    };
  });
  const total =
    service.price && currency
      ? Math.round(
          sessions.reduce((sum, session) => sum + (session.price ?? 0), 0) * 100
        ) / 100
      : null;
  return { kind: 'days', sessions, count: sessions.length, total, currency };
}
