import type {
  BookingAnswer,
  BookingItem,
  BookingService,
} from '@internal/core/types/Form';
import {
  isEmptyItem,
  isPlan,
  itemsOf,
  monthlySessions,
} from './booking-answer.ts';
import {
  allowanceOf,
  monthlyMinutes,
  optionFor,
  type Allowance,
} from './booking-options.ts';

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
  allowance: Allowance | null;
};

export type AllSummary = {
  items: { service: BookingService; summary: BookingSummary }[];
  count: number;
  total: number | null;
  currency: string | null;
};

export function summarizeAll(
  services: BookingService[] | undefined,
  answer: BookingAnswer | undefined,
  today: Date
): AllSummary | null {
  const items = itemsOf(answer).flatMap(item => {
    const service = services?.find(entry => entry.id === item.service);
    const summary = summarize(service, item, today);
    return service && summary ? [{ service, summary }] : [];
  });
  if (items.length === 0) return null;
  const totals = items.flatMap(({ summary }) =>
    summary.total === null ? [] : [summary.total]
  );
  return {
    items,
    count: items.reduce((sum, { summary }) => sum + summary.count, 0),
    total: totals.length
      ? Math.round(totals.reduce((sum, amount) => sum + amount, 0) * 100) / 100
      : null,
    currency: items.find(({ summary }) => summary.currency)?.summary.currency ?? null,
  };
}

export function summarize(
  service: BookingService | undefined,
  answer: BookingItem | undefined,
  today: Date
): BookingSummary | null {
  if (!service || !answer || isEmptyItem(answer)) return null;
  const currency = service.currency || null;

  if (answer.monthly) {
    const duration = monthlyMinutes(service);
    const sessions = monthlySessions(answer.monthly, today).map(session => ({
      ...session,
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
      allowance: isPlan(answer.monthly) ? allowanceOf(service) : null,
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
  return {
    kind: 'days',
    sessions,
    count: sessions.length,
    total,
    currency,
    allowance: null,
  };
}
