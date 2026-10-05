import { activeLocale } from './index';

type DateInput = Date | string | number;

const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value));

export function formatDate(value: DateInput, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  return new Intl.DateTimeFormat(activeLocale(), options).format(toDate(value));
}

export function formatDateTime(value: DateInput, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) {
  return new Intl.DateTimeFormat(activeLocale(), options).format(toDate(value));
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(activeLocale(), options).format(value);
}

export function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(activeLocale(), { style: 'currency', currency }).format(value);
}
