import { useTranslation } from 'react-i18next';
import { activeLocale } from './index';

type DateInput = Date | string | number;

export function useLocale() {
  useTranslation();
  return activeLocale();
}

const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value));

export function formatDate(value: DateInput, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  return new Intl.DateTimeFormat(activeLocale(), options).format(toDate(value));
}

export function formatDateTime(value: DateInput, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) {
  return new Intl.DateTimeFormat(activeLocale(), options).format(toDate(value));
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

export function formatRelative(value: DateInput, now: number = Date.now()) {
  const seconds = Math.round((toDate(value).getTime() - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat(activeLocale(), { numeric: 'auto' });
  const [unit, size] = UNITS.find(([, size]) => Math.abs(seconds) >= size) ?? ['second', 1];
  return formatter.format(Math.round(seconds / size), unit);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(activeLocale(), options).format(value);
}

export function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(activeLocale(), { style: 'currency', currency }).format(value);
}
