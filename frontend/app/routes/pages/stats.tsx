import { AreaChart } from '@mantine/charts';
import {
  Button,
  Center,
  Loader,
  SegmentedControl,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconChartBar,
  IconClick,
  IconCopy,
  IconEyeOff,
  IconLink,
  IconLock,
} from '@tabler/icons-react';
import { useClipboard } from '@mantine/hooks';
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Alert, Card, PageContainer } from '@internal/ui';
import { useGetPage } from '@internal/core/actions/get-page/get-page.hook';
import { useGetPageStatistics } from '@internal/core/actions/get-page-statistics/get-page-statistics.hook';
import type {
  PageStatisticsBucket,
  PageStatisticsLink,
  PageStatisticsPeriod,
} from '@internal/core/actions/get-page-statistics/get-page-statistics.types';
import { socialNetworkById } from '../../modules/bio-page';

export const ssr = false;

export function meta() {
  return [{ title: 'Page statistics - Kurz' }];
}

const PERIODS: { label: string; value: PageStatisticsPeriod }[] = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

const countryNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : undefined;

function countryLabel(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  const flag = String.fromCodePoint(
    ...[...code].map(char => 0x1f1e6 + char.charCodeAt(0) - 65)
  );
  return `${flag} ${countryNames?.of(code) ?? code}`;
}

function formatDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function share(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function StatCard({
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

// A ranked list with a bar behind each row, sized against the largest.
function BarList({
  title,
  items,
  label = item => item.name,
  empty = 'No clicks in this period.',
}: {
  title: string;
  items: PageStatisticsBucket[];
  label?: (item: PageStatisticsBucket) => ReactNode;
  empty?: string;
}) {
  const max = Math.max(1, ...items.map(item => item.clicks));
  const total = items.reduce((sum, item) => sum + item.clicks, 0);

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
                style={{ width: `${(item.clicks / max) * 100}%` }}
                aria-hidden="true"
              />
              <span className="relative min-w-0 truncate text-foreground">
                {label(item)}
              </span>
              <span className="relative shrink-0 tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {item.clicks}
                </span>{' '}
                · {share(item.clicks, total)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LinkRow({ link, max }: { link: PageStatisticsLink; max: number }) {
  const network = socialNetworkById(link.icon);
  const Icon = network?.icon ?? IconLink;

  return (
    <li className="relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm">
      <span
        className="absolute inset-y-0 left-0 rounded-md bg-primary/15"
        style={{ width: `${(link.clicks / Math.max(1, max)) * 100}%` }}
        aria-hidden="true"
      />
      <Icon
        size={17}
        stroke={1.8}
        className="relative shrink-0 text-muted-foreground"
      />
      <span className="relative min-w-0 flex-1 truncate text-foreground">
        {link.kind === 'social'
          ? `${network?.name ?? link.label} icon`
          : link.label}
      </span>
      {!link.active && (
        <Tooltip label="Hidden from your page" withArrow>
          <IconEyeOff
            size={15}
            className="relative shrink-0 text-muted-foreground"
            aria-label="Hidden"
          />
        </Tooltip>
      )}
      <span className="relative shrink-0 text-right tabular-nums">
        <span className="font-semibold text-foreground">{link.clicks}</span>
        <span className="ml-1.5 hidden text-xs text-muted-foreground sm:inline">
          {link.total_clicks} all time
        </span>
      </span>
    </li>
  );
}

export default function PageStatisticsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const clipboard = useClipboard({ timeout: 1500 });
  const [days, setDays] = useState<PageStatisticsPeriod>(30);
  const { data: page } = useGetPage(id);
  const {
    data: stats,
    isLoading,
    isFetching,
    error,
  } = useGetPageStatistics(id, days);

  const back = (
    <Button
      variant="subtle"
      color="gray"
      leftSection={<IconArrowLeft size={16} />}
      onClick={() => navigate(`/app/pages/${id}`)}
    >
      Back to editor
    </Button>
  );

  if (error) {
    return (
      <PageContainer>
        {back}
        <Alert
          variant="error"
          icon={<IconLock size={24} />}
          title="Could not load the statistics"
        >
          This page does not exist or is not yours.
        </Alert>
      </PageContainer>
    );
  }

  if (isLoading || !stats) {
    return (
      <Center py="xl">
        <Loader size="lg" color="brand" />
      </Center>
    );
  }

  const topLink = stats.links.find(link => link.clicks > 0);
  const topSource =
    stats.sources.find(source => source.name !== 'Direct') ?? stats.sources[0];
  const maxLink = Math.max(0, ...stats.links.map(link => link.clicks));

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <div className="mb-4">{back}</div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <IconChartBar size={21} stroke={1.8} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-muted-foreground">
              {page
                ? `${page.display_title || page.slug} · @${page.slug}`
                : 'Bio page'}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Statistics
            </h1>
          </div>
        </div>
        <SegmentedControl
          value={String(days)}
          onChange={value => setDays(Number(value) as PageStatisticsPeriod)}
          data={PERIODS.map(period => ({
            label: period.label,
            value: String(period.value),
          }))}
          className={isFetching ? 'opacity-70' : ''}
        />
      </div>

      {stats.total_clicks === 0 ? (
        <Card className="p-8 text-center">
          <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <IconClick size={24} />
          </div>
          <p className="mt-4 font-semibold text-foreground">No clicks yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Share your page and every click on a link or social icon shows up
            here: when, where from and on what device.
          </p>
          {page && (
            <Button
              className="mt-5"
              variant="default"
              leftSection={<IconCopy size={16} />}
              onClick={() => clipboard.copy(page.public_url)}
            >
              {clipboard.copied ? 'Copied' : 'Copy page link'}
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label={`Clicks · last ${days} days`}
              value={stats.period_clicks}
            />
            <StatCard label="Clicks · all time" value={stats.total_clicks} />
            <StatCard
              label="Top link"
              value={topLink ? topLink.clicks : '–'}
              hint={
                topLink
                  ? topLink.kind === 'social'
                    ? `${socialNetworkById(topLink.icon)?.name ?? topLink.label} icon`
                    : topLink.label
                  : 'No clicks in this period'
              }
            />
            <StatCard
              label="Top source"
              value={topSource ? topSource.name : '–'}
              hint={
                topSource
                  ? `${share(topSource.clicks, stats.period_clicks)}% of clicks`
                  : 'No clicks in this period'
              }
            />
          </div>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              Clicks per day
            </h2>
            <AreaChart
              h={220}
              data={stats.timeline.map(day => ({
                ...day,
                day: formatDay(day.date),
              }))}
              dataKey="day"
              series={[{ name: 'clicks', label: 'Clicks', color: 'brand.5' }]}
              curveType="monotone"
              withDots={days <= 30}
              gridAxis="x"
              tickLine="none"
              withGradient
              yAxisProps={{ allowDecimals: false, width: 32 }}
              xAxisProps={{ minTickGap: 24 }}
            />
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">
                Links and icons
              </h2>
              <span className="text-xs text-muted-foreground">
                Last {days} days
              </span>
            </div>
            <ul className="space-y-1">
              {stats.links.map(link => (
                <LinkRow key={link.id} link={link} max={maxLink} />
              ))}
            </ul>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <BarList title="Where visitors came from" items={stats.sources} />
            <BarList
              title="Countries"
              items={stats.countries}
              label={item => countryLabel(item.name)}
            />
            <BarList title="Devices" items={stats.devices} />
            <BarList title="Browsers" items={stats.browsers} />
          </div>

          <p className="text-xs text-muted-foreground">
            Repeated clicks by the same visitor within a few seconds count once.
            Days are in UTC.
          </p>
        </div>
      )}
    </PageContainer>
  );
}
