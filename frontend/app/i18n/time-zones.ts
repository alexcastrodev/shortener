export const DEFAULT_TIME_ZONE = 'Europe/Lisbon';

export function timeZoneOptions(current?: string): string[] {
  const zones = new Set<string>(['UTC', ...Intl.supportedValuesOf('timeZone')]);
  if (current) zones.add(current);
  return [...zones].sort((a, b) => a.localeCompare(b));
}
