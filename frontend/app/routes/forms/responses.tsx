import { BarChart } from '@mantine/charts';
import {
  ActionIcon,
  Button,
  Drawer,
  Menu,
  SegmentedControl,
  TextInput,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconCopy,
  IconLink,
  IconDots,
  IconDownload,
  IconPencil,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatDateTime, formatNumber } from '../../i18n/format';
import { useNavigate, useParams } from 'react-router';
import { Alert, Card, PageContainer } from '@internal/ui';
import { useGetForm } from '@internal/core/actions/get-form/get-form.hook';
import {
  getFormResponsesKey,
  useGetFormResponses,
} from '@internal/core/actions/get-form-responses/get-form-responses.hook';
import { getFormResponses } from '@internal/core/actions/get-form-responses/get-form-responses.service';
import { getFormUpload } from '@internal/core/actions/get-form-upload/get-form-upload.service';
import { exportFormResponses } from '@internal/core/actions/export-form-responses/export-form-responses.service';
import { useGetShortlinkDetails } from '@internal/core/actions/get-shortlink-details/get-shortlink-details.hook';
import { useEventStatistics } from '@internal/core/actions/get-event-statistics/get-event-statistics.hook';
import { useGetFormSummary } from '@internal/core/actions/get-form-summary/get-form-summary.hook';
import { useDeleteFormResponse } from '@internal/core/actions/delete-form-response/delete-form-response.hook';
import { useDeleteFormResponses } from '@internal/core/actions/delete-form-responses/delete-form-responses.hook';
import { getFormKey } from '@internal/core/actions/get-form/get-form.hook';
import { getFormsKey } from '@internal/core/actions/get-forms/get-forms.hook';
import type {
  FormFieldSummary,
  FormResponse,
  FormSummaryPeriod,
} from '@internal/core/types/Form';
import {
  BarList,
  countryLabel,
  formatDay,
  share,
} from '../../components/stats';
import { FIELD_ICONS, isSection } from '../../modules/forms/field-types';
import { formErrorMessage } from '../../modules/forms/form-errors';
import { AppointmentsTab } from './components/appointments-tab';
import type { Route } from './+types/responses';

export const ssr = false;

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Responses - Kurz' }];
}

const PERIODS = [
  { label: 'period_7', value: 7 },
  { label: 'period_30', value: 30 },
  { label: 'period_90', value: 90 },
  { label: 'period_all', value: 'all' },
] as const satisfies readonly { label: string; value: FormSummaryPeriod }[];

const TABLE_QUESTIONS = 4;

type Tab = 'summary' | 'responses' | 'appointments';

function ResponseImage({ formId, token }: { formId: string; token: string }) {
  const { t } = useTranslation('responses');
  const [state, setState] = useState<{ url?: string; failed?: boolean }>({});

  useEffect(() => {
    let url: string | undefined;
    let cancelled = false;
    getFormUpload(formId, token)
      .then(blob => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setState({ url });
      })
      .catch(() => !cancelled && setState({ failed: true }));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [formId, token]);

  if (state.failed) return <p className="mt-0.5 text-sm text-muted-foreground">{t('image_unavailable')}</p>;
  if (!state.url) return <p className="mt-0.5 text-sm text-muted-foreground">{t('image_loading')}</p>;
  return <img src={state.url} alt={t('image_alt')} className="mt-1 max-h-80 max-w-full rounded-md border border-border" />;
}

function formatAnswer(value: FormResponse['answers'][number]['value'], type?: string) {
  if (value === null || value === undefined) return '—';
  const t = i18n.getFixedT(null, 'responses');
  if (type === 'image') return t('answer_image');
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return value.sessions.map(session => `${session.date} ${session.time}`).join(', ');
  if (typeof value === 'boolean') return value ? t('answer_yes') : t('answer_no');
  return String(value);
}

function formatWhen(iso: string) {
  return formatDateTime(iso, { dateStyle: 'medium', timeStyle: 'short' });
}

const csvCell = (value: string) => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
};

export default function FormResponsesPage() {
  const { t } = useTranslation('responses');
  const { t: tAppointments } = useTranslation('appointments');
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: form, error } = useGetForm(id);
  const [tab, setTab] = useState<Tab>('summary');
  const [days, setDays] = useState<FormSummaryPeriod>(30);
  const [open, setOpen] = useState<FormResponse | null>(null);
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const summary = useGetFormSummary(id, days);
  const responses = useGetFormResponses(id, days);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getFormResponsesKey(id) });
    queryClient.invalidateQueries({ queryKey: ['form-summary', id] });
    queryClient.invalidateQueries({ queryKey: getFormKey(id) });
    queryClient.invalidateQueries({ queryKey: getFormsKey });
  };
  const onError = (failure: unknown) =>
    notifications.show({ title: t('error_title'), message: formErrorMessage(failure), color: 'red' });

  const { mutate: removeOne } = useDeleteFormResponse({
    onSuccess: () => {
      setOpen(null);
      refresh();
    },
    onError,
  });
  const { mutate: removeAll } = useDeleteFormResponses({ onSuccess: refresh, onError });

  if (error) {
    return (
      <PageContainer>
        <Alert title={t('load_failed_title')}>{t('load_failed_body')}</Alert>
      </PageContainer>
    );
  }

  const questions = (form?.fields ?? []).filter(field => !isSection(field));
  const rows = responses.data?.pages.flatMap(page => page.response) ?? [];
  const total = form?.responses_count ?? 0;
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? rows.filter(row =>
        row.answers.some(answer => formatAnswer(answer.value, answer.type).toLowerCase().includes(needle))
      )
    : rows;
  const stats = summary.data;
  const bookingField = form?.fields.find(field => field.type === 'booking');
  const hasBooking = Boolean(bookingField);
  const bookingZone = bookingField?.rules?.time_zone ?? 'UTC';
  const inPeriod = stats?.funnel.completions ?? total;

  const exportExcel = async () => {
    setExporting(true);
    try {
      const blob = await exportFormResponses(id, days);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${(form?.title ?? 'form').replace(/[^\w-]+/g, '-')}-responses.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (failure) {
      const status = (failure as { response?: { status?: number } })?.response?.status;
      if (status === 413) {
        notifications.show({ color: 'red', message: t('export_too_large') });
      } else if (status === 429) {
        notifications.show({ color: 'red', message: t('export_rate') });
      } else {
        onError(failure);
      }
    } finally {
      setExporting(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all: FormResponse[] = [];
      let before: number | null = null;
      do {
        const page = await getFormResponses(id, before, days);
        all.push(...page.response);
        before = page.next_before;
      } while (before);
      const header = [t('csv_submitted'), ...questions.map(q => q.label), t('csv_source'), t('csv_platform'), t('csv_browser'), t('csv_country')];
      const lines = all.map(row => {
        const byId = new Map(row.answers.map(answer => [answer.id, answer.value]));
        return [
          row.submitted_at,
          ...questions.map(q => (byId.has(q.id) ? formatAnswer(byId.get(q.id)!, q.type) : '')),
          row.source ?? '',
          row.platform ?? '',
          row.browser ?? '',
          row.country ?? '',
        ]
          .map(cell => csvCell(String(cell)))
          .join(',');
      });
      const blob = new Blob([`﻿${[header.map(csvCell).join(','), ...lines].join('\r\n')}`], {
        type: 'text/csv;charset=utf-8',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${(form?.title ?? 'form').replace(/[^\w-]+/g, '-')}-responses.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (failure) {
      onError(failure);
    } finally {
      setExporting(false);
    }
  };

  const confirmDeleteOne = (response: FormResponse) =>
    modals.openConfirmModal({
      title: t('delete_one_title'),
      centered: true,
      children: <p className="text-sm">{t('delete_one_body')}</p>,
      labels: { confirm: t('delete_one_confirm'), cancel: t('keep_it') },
      confirmProps: { color: 'red' },
      onConfirm: () => removeOne({ formId: id, responseId: response.id }),
    });

  const confirmDeleteAll = () =>
    modals.openConfirmModal({
      title: t('delete_all_title'),
      centered: true,
      children: (
        <div className="space-y-3">
          <p className="text-sm">
            {t('delete_all_body', { count: total, title: form?.title })}
          </p>
          <Button
            variant="subtle"
            size="compact-sm"
            leftSection={<IconDownload size={14} />}
            onClick={exportCsv}
          >
            {t('export_first')}
          </Button>
        </div>
      ),
      labels: { confirm: t('delete_all_confirm'), cancel: t('cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => removeAll(id),
    });

  const tabButton = (name: Tab, label: string, count?: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === name}
      onClick={() => setTab(name)}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${
        tab === name
          ? 'border-primary font-medium text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className="ml-1.5 text-xs text-muted-foreground">{formatNumber(count)}</span>
      )}
    </button>
  );

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ActionIcon
            variant="default"
            size="lg"
            aria-label={t('back_to_forms')}
            onClick={() => navigate('/app/forms')}
          >
            <IconArrowLeft size={16} />
          </ActionIcon>
          <div className="leading-tight">
            <p className="text-xs text-muted-foreground">{t('forms')}</p>
            <p className="text-sm font-semibold">{form?.title ?? '…'}</p>
          </div>
          {form && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                form.published ? 'bg-teal-500/15 text-teal-400' : 'bg-muted text-muted-foreground'
              }`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {form.published ? t('live') : t('draft')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            leftSection={<IconPencil size={16} />}
            onClick={() => navigate(`/app/forms/${id}`)}
          >
            {t('edit_form')}
          </Button>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <Button color="brand" loading={exporting} disabled={total === 0} leftSection={<IconDownload size={16} />}>
                {t('export')}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={exportExcel}>{t('export_excel')}</Menu.Item>
              <Menu.Item onClick={exportCsv}>{t('export_csv')}</Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="default" size="lg" aria-label={t('more_actions')}>
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                color="red"
                c="red.5"
                disabled={total === 0}
                leftSection={<IconTrash size={14} />}
                onClick={confirmDeleteAll}
              >
                {t('delete_all')}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border">
        <div role="tablist" className="flex gap-1">
          {tabButton('summary', t('tab_summary'))}
          {tabButton('responses', t('tab_responses'), total)}
          {hasBooking && tabButton('appointments', tAppointments('tab'))}
        </div>
        {tab !== 'appointments' && (
        <SegmentedControl
          size="xs"
          className="mb-2"
          aria-label={t('period')}
          value={String(days)}
          onChange={value =>
            setDays(value === 'all' ? 'all' : (Number(value) as FormSummaryPeriod))
          }
          data={PERIODS.map(period => ({ label: t(period.label), value: String(period.value) }))}
        />
        )}
      </div>

      {tab === 'appointments' && hasBooking && form && (
        <AppointmentsTab formId={form.id} title={form.title} timeZone={bookingZone} />
      )}

      {tab === 'summary' &&
        (!stats ? (
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        ) : (
          <div className="space-y-4">
            <Card className="grid grid-cols-2 divide-border p-0 lg:grid-cols-4 lg:divide-x">
              {[
                { label: t('views'), value: formatNumber(stats.funnel.views), hint: t('unique', { count: stats.funnel.unique_views }) },
                { label: t('started'), value: formatNumber(stats.funnel.starts), hint: t('of_views', { n: share(stats.funnel.starts, stats.funnel.views) }) },
                { label: t('completed'), value: formatNumber(stats.funnel.completions), hint: t('of_started', { n: share(stats.funnel.completions, stats.funnel.starts) }) },
                { label: t('completion_rate'), value: stats.funnel.completion_rate === null ? '—' : `${Math.round(stats.funnel.completion_rate * 100)}%`, hint: t('of_people_started') },
              ].map(item => (
                <div key={item.label} className="min-w-0 p-5">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 truncate text-3xl font-semibold tracking-tight">{item.value}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{item.hint}</p>
                </div>
              ))}
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 text-sm font-semibold">{t('views_and_responses')}</h2>
              <BarChart
                h={220}
                data={stats.timeline.map(day => ({ ...day, day: formatDay(day.date) }))}
                dataKey="day"
                series={[
                  { name: 'views', label: t('views'), color: 'gray.7' },
                  { name: 'responses', label: t('completed'), color: 'brand.5' },
                ]}
                withLegend
                legendProps={{ verticalAlign: 'top', align: 'right', height: 28 }}
                tickLine="none"
                gridAxis="y"
                yAxisProps={{ allowDecimals: false, width: 32 }}
              />
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <BarList title={t('sources_title')} items={stats.audience.sources.map(b => ({ name: b.name, value: b.count }))} />
              <BarList title={t('countries')} items={stats.audience.countries.map(b => ({ name: b.name, value: b.count }))} label={item => countryLabel(item.name)} />
              <BarList title={t('devices')} items={stats.audience.devices.map(b => ({ name: b.name, value: b.count }))} />
              <BarList title={t('browsers')} items={stats.audience.browsers.map(b => ({ name: b.name, value: b.count }))} />
            </div>

            {form?.shortlink_id && <ShortLinkClicks shortlinkId={form.shortlink_id} />}

            <div className="flex items-baseline justify-between pt-2">
              <h2 className="text-lg font-semibold">{t('questions')}</h2>
              <span className="text-xs text-muted-foreground">
                {t('in_period', { count: stats.funnel.completions })}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {stats.fields.map((field, index) => (
                <FieldSummaryCard
                  key={field.id}
                  field={field}
                  number={index + 1}
                  respondents={stats.funnel.completions}
                  onSeeAll={() => setTab('responses')}
                />
              ))}
            </div>
          </div>
        ))}

      {tab === 'responses' && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <TextInput
              className="w-full sm:w-80"
              placeholder={t('search_answers')}
              aria-label={t('search_answers')}
              leftSection={<IconSearch size={16} />}
              value={query}
              onChange={event => setQuery(event.currentTarget.value)}
            />
            <span className="text-sm text-muted-foreground">
              {t('response_count', { count: inPeriod })}
            </span>
          </div>

          {responses.isLoading && <div className="h-24 animate-pulse rounded-lg bg-muted" />}
          {!responses.isLoading && rows.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              {t('no_responses')}
            </Card>
          )}
          {rows.length > 0 && (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-normal">{t('col_submitted')}</th>
                    {questions.slice(0, TABLE_QUESTIONS).map(question => (
                      <th key={question.id} className="px-4 py-3 font-normal">
                        {question.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 font-normal">{t('col_country')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(row => {
                    const byId = new Map(row.answers.map(answer => [answer.id, answer.value]));
                    return (
                      <tr
                        key={row.id}
                        tabIndex={0}
                        onClick={() => setOpen(row)}
                        onKeyDown={event => event.key === 'Enter' && setOpen(row)}
                        className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/40"
                      >
                        <td className="whitespace-nowrap px-4 py-3">{formatWhen(row.submitted_at)}</td>
                        {questions.slice(0, TABLE_QUESTIONS).map(question => (
                          <td key={question.id} className="max-w-[220px] truncate px-4 py-3">
                            {formatAnswer(byId.get(question.id) ?? null, question.type)}
                          </td>
                        ))}
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {row.country ? countryLabel(row.country) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
          {rows.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {t('showing', { shown: formatNumber(visible.length), total: formatNumber(inPeriod) })}
              </span>
              {responses.hasNextPage && (
                <Button
                  variant="default"
                  size="xs"
                  loading={responses.isFetchingNextPage}
                  onClick={() => responses.fetchNextPage()}
                >
                  {t('load_more')}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <Drawer opened={!!open} onClose={() => setOpen(null)} position="right" title={t('drawer_title')} size="md">
        {open && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">{formatWhen(open.submitted_at)}</p>
            {open.answers.map(answer => (
              <div key={answer.id}>
                <p className="text-xs font-medium text-muted-foreground">{answer.label}</p>
                {answer.type === 'image' && typeof answer.value === 'string' ? (
                  <ResponseImage formId={id} token={answer.value} />
                ) : (
                  <p className="mt-0.5 whitespace-pre-line text-sm">{formatAnswer(answer.value, answer.type)}</p>
                )}
              </div>
            ))}
            <Button variant="subtle" color="red" c="red.5" leftSection={<IconTrash size={16} />} onClick={() => confirmDeleteOne(open)}>
              {t('delete_one_confirm')}
            </Button>
          </div>
        )}
      </Drawer>
    </PageContainer>
  );
}

function ShortLinkClicks({ shortlinkId }: { shortlinkId: number }) {
  const { t } = useTranslation('responses');
  const link = useGetShortlinkDetails(shortlinkId).data;
  const stats = useEventStatistics(shortlinkId).data;
  if (!link) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.short_url);
      notifications.show({ message: t('link_copied'), color: 'teal' });
    } catch {
      notifications.show({ message: link.short_url, color: 'gray' });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <IconLink size={16} /> {t('short_link')}
          </h2>
          <p className="mt-1 truncate font-mono text-sm text-muted-foreground">{link.short_url}</p>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-muted-foreground">{t('clicks_all_time')}</p>
            <p className="text-2xl font-semibold tabular-nums">{formatNumber(link.events_count)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('last_click')}</p>
            <p className="text-sm">{link.last_accessed_at ? formatWhen(link.last_accessed_at) : '—'}</p>
          </div>
          <Button variant="default" leftSection={<IconCopy size={16} />} onClick={copy}>
            {t('copy')}
          </Button>
        </div>
      </Card>
      {link.events_count > 0 && stats && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <BarList
            title={t('clicks_by_device')}
            items={(stats.device_statistics ?? []).map(item => ({ name: item.name, value: item.value }))}
          />
          <BarList
            title={t('clicks_by_browser')}
            items={(stats.browser_statistics ?? []).map(item => ({ name: item.name, value: item.value }))}
          />
          <BarList
            title={t('clicks_by_country')}
            items={(stats.country_statistics ?? []).map(item => ({ name: item.country, value: item.count }))}
            label={item => countryLabel(item.name)}
          />
        </div>
      )}
    </div>
  );
}

function FieldSummaryCard({
  field,
  number,
  respondents,
  onSeeAll,
}: {
  field: FormFieldSummary;
  number: number;
  respondents: number;
  onSeeAll: () => void;
}) {
  const { t } = useTranslation('responses');
  const Icon = FIELD_ICONS[field.type];
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            <span className="mr-2 font-mono text-xs text-primary">
              {String(number).padStart(2, '0')}
            </span>
            {field.label}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('answered_line', { answered: formatNumber(field.answered), n: share(field.answered, respondents) })}
          </p>
        </div>
      </div>
      {field.choices && (
        <BarList title="" items={field.choices.map(choice => ({ name: choice.label, value: choice.count }))} />
      )}
      {field.distribution && (
        <>
          <p className="mb-2 text-sm">{t('average_line', { value: field.average ?? '—' })}</p>
          <BarList title="" items={field.distribution.map(point => ({ name: String(point.rating), value: point.count }))} />
        </>
      )}
      {field.type === 'yes_no' && (
        <p className="text-sm">
          {t('yes_no_line', { yes: field.yes ?? 0, no: field.no ?? 0 })}
        </p>
      )}
      {field.type === 'number' && field.average != null && (
        <p className="text-sm">
          {t('number_line', { min: field.min, avg: field.average, max: field.max })}
        </p>
      )}
      {field.type === 'date' && field.first && (
        <p className="text-sm">
          {t('date_line', { first: field.first, last: field.last })}
        </p>
      )}
      {field.samples && field.samples.length > 0 && (
        <>
          <ul className="divide-y divide-border text-sm">
            {field.samples.map((sample, index) => (
              <li key={index} className="truncate py-2">
                {sample}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onSeeAll}
            className="mt-3 text-sm text-primary hover:underline"
          >
            {t('see_all')}
          </button>
        </>
      )}
    </Card>
  );
}
