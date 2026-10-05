import type { ReactNode } from 'react';
import { Card } from '@internal/ui';
import { activeLocale } from '../../i18n';
import { formatDate } from '../../i18n/format';

export type Bucket = { name: string; value: number };

const countryNames = new Map<string, Intl.DisplayNames>();

function regionNames() {
  if (typeof Intl === 'undefined' || !('DisplayNames' in Intl)) return undefined;
  const locale = activeLocale();
  let names = countryNames.get(locale);
  if (!names) {
    names = new Intl.DisplayNames([locale], { type: 'region' });
    countryNames.set(locale, names);
  }
  return names;
}

export function countryLabel(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  const flag = String.fromCodePoint(
    ...[...code].map(char => 0x1f1e6 + char.charCodeAt(0) - 65)
  );
  return `${flag} ${regionNames()?.of(code) ?? code}`;
}

export function formatDay(date: string) {
  return formatDate(`${date}T00:00:00Z`, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function share(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <Card className="min-w-0 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint && (
        <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
      )}
    </Card>
  );
}

export function BarList({
  title,
  items,
  label = item => item.name,
  empty = 'Nothing in this period.',
}: {
  title: string;
  items: Bucket[];
  label?: (item: Bucket) => ReactNode;
  empty?: string;
}) {
  const max = Math.max(1, ...items.map(item => item.value));
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="min-w-0 p-5">
      <h2 className="mb-4 text-sm font-semibold text-foreground">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map(item => (
            <li
              key={item.name}
              className="relative flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm"
            >
              <span
                className="absolute inset-y-0 left-0 rounded-md bg-primary/15"
                style={{ width: `${(item.value / max) * 100}%` }}
                aria-hidden="true"
              />
              <span className="relative min-w-0 truncate text-foreground">
                {label(item)}
              </span>
              <span className="relative shrink-0 tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {item.value}
                </span>{' '}
                · {share(item.value, total)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
