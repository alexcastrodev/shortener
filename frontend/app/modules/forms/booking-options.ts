import type { BookingService } from '@internal/core/types/Form';

export type BookingOption = { duration: number; price: number | null };

export type DurationWords = {
  minutes: (count: number) => string;
  hours: (count: number) => string;
  hoursMinutes: (hours: number, minutes: number) => string;
};

type Offer = Pick<BookingService, 'duration' | 'price' | 'extra_durations'>;

export function bookingOptions(service: Offer): BookingOption[] {
  const seen = new Set<number>();
  return [
    { duration: service.duration, price: service.price ?? null },
    ...(service.extra_durations ?? []).map(item => ({
      duration: item.duration,
      price: item.price ?? null,
    })),
  ].filter(item => !seen.has(item.duration) && seen.add(item.duration));
}

export const hasSeveralDurations = (service: Offer) =>
  bookingOptions(service).length > 1;

export const optionFor = (service: Offer, minutes: number | undefined) =>
  bookingOptions(service).find(
    item => item.duration === (minutes ?? service.duration)
  );

export function cheapestPrice(service: Offer): number | null {
  const prices = bookingOptions(service)
    .map(item => item.price)
    .filter((price): price is number => price !== null);
  return prices.length ? Math.min(...prices) : null;
}

export const monthlyMinutes = (service: Pick<BookingService, 'duration' | 'monthly'>) =>
  service.monthly?.duration ?? service.duration;

export function durationText(minutes: number, words: DurationWords): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return words.minutes(minutes);
  return rest === 0 ? words.hours(hours) : words.hoursMinutes(hours, rest);
}

export function endTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const total = (hours * 60 + mins + minutes) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
