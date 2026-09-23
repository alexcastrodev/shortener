// <input type="datetime-local"> works with "YYYY-MM-DDTHH:mm" in the
// visitor's local time; the API speaks ISO 8601 in UTC.
export function isoToDateTimeLocal(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function dateTimeLocalToIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function isFutureDateTimeLocal(value: string): boolean {
  return !value || new Date(value).getTime() > Date.now();
}
