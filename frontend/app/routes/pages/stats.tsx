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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../i18n/format';
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
import {
  BarList as SharedBarList,
  StatCard,
  countryLabel,
  formatDay,
  share,
} from '../../components/stats';

export const ssr = false;

export function meta() {
  return [{ title: 'Page statistics - Kurz' }];
}

const PERIODS = [
  { label: 'stats_period_7', value: 7 },
  { label: 'stats_period_30', value: 30 },
  { label: 'stats_period_90', value: 90 },
] as const satisfies readonly { label: string; value: PageStatisticsPeriod }[];

function BarList({
  items,
  ...rest
}: {
  title: string;
  items: PageStatisticsBucket[];
  label?: (item: PageStatisticsBucket) => React.ReactNode;
  empty?: string;
}) {
  const { t } = useTranslation('pages');
  return (
    <SharedBarList
      {...rest}
      empty={rest.empty ?? t('stats_empty_list')}
      items={items.map(item => ({ name: item.name, value: item.clicks }))}
      label={rest.label ? item => rest.label!({ name: item.name, clicks: item.value }) : undefined}
    />
  );
}

function LinkRow({ link, max }: { link: PageStatisticsLink; max: number }) {
  const { t } = useTranslation('pages');
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
          ? t('stats_icon', { name: network?.name ?? link.label })
          : link.label}
      </span>
      {!link.active && (
        <Tooltip label={t('stats_hidden')} withArrow>
          <IconEyeOff
            size={15}
            className="relative shrink-0 text-muted-foreground"
            aria-label={t('stats_hidden_label')}
          />
        </Tooltip>
      )}
      <span className="relative shrink-0 text-right tabular-nums">
        <span className="font-semibold text-foreground">{formatNumber(link.clicks)}</span>
        <span className="ml-1.5 hidden text-xs text-muted-foreground sm:inline">
          {t('stats_all_time', { n: formatNumber(link.total_clicks) })}
        </span>
      </span>
    </li>
  );
}

export default function PageStatisticsPage() {
  const { t } = useTranslation('pages');
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
      {t('stats_back')}
    </Button>
  );

  if (error) {
    return (
      <PageContainer>
        {back}
        <Alert
          variant="error"
          icon={<IconLock size={24} />}
          title={t('stats_load_failed_title')}
        >
          {t('stats_load_failed_body')}
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
                : t('stats_page_fallback')}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t('stats_title')}
            </h1>
          </div>
        </div>
        <SegmentedControl
          value={String(days)}
          onChange={value => setDays(Number(value) as PageStatisticsPeriod)}
          data={PERIODS.map(period => ({
            label: t(period.label),
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
          <p className="mt-4 font-semibold text-foreground">{t('stats_no_clicks_title')}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {t('stats_no_clicks_body')}
          </p>
          {page && (
            <Button
              className="mt-5"
              variant="default"
              leftSection={<IconCopy size={16} />}
              onClick={() => clipboard.copy(page.public_url)}
            >
              {clipboard.copied ? t('stats_copied') : t('stats_copy_link')}
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label={t('stats_clicks_period', { n: days })}
              value={formatNumber(stats.period_clicks)}
            />
            <StatCard label={t('stats_clicks_all')} value={formatNumber(stats.total_clicks)} />
            <StatCard
              label={t('stats_top_link')}
              value={topLink ? formatNumber(topLink.clicks) : '–'}
              hint={
                topLink
                  ? topLink.kind === 'social'
                    ? t('stats_icon', { name: socialNetworkById(topLink.icon)?.name ?? topLink.label })
                    : topLink.label
                  : t('stats_no_clicks_period')
              }
            />
            <StatCard
              label={t('stats_top_source')}
              value={topSource ? topSource.name : '–'}
              hint={
                topSource
                  ? t('stats_source_share', { n: share(topSource.clicks, stats.period_clicks) })
                  : t('stats_no_clicks_period')
              }
            />
          </div>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              {t('stats_per_day')}
            </h2>
            <AreaChart
              h={220}
              data={stats.timeline.map(day => ({
                ...day,
                day: formatDay(day.date),
              }))}
              dataKey="day"
              series={[{ name: 'clicks', label: t('stats_clicks'), color: 'brand.5' }]}
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
                {t('stats_links_icons')}
              </h2>
              <span className="text-xs text-muted-foreground">
                {t('stats_last_days', { n: days })}
              </span>
            </div>
            <ul className="space-y-1">
              {stats.links.map(link => (
                <LinkRow key={link.id} link={link} max={maxLink} />
              ))}
            </ul>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <BarList title={t('stats_sources')} items={stats.sources} />
            <BarList
              title={t('stats_countries')}
              items={stats.countries}
              label={item => countryLabel(item.name)}
            />
            <BarList title={t('stats_devices')} items={stats.devices} />
            <BarList title={t('stats_browsers')} items={stats.browsers} />
          </div>

          <p className="text-xs text-muted-foreground">
            {t('stats_footnote')}
          </p>
        </div>
      )}
    </PageContainer>
  );
}
