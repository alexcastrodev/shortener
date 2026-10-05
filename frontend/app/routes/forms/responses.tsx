import { AreaChart } from '@mantine/charts';
import { Badge, Button, Drawer, SegmentedControl, Tabs } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Alert, Card, PageContainer } from '@internal/ui';
import { useGetForm } from '@internal/core/actions/get-form/get-form.hook';
import {
  getFormResponsesKey,
  useGetFormResponses,
} from '@internal/core/actions/get-form-responses/get-form-responses.hook';
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
  StatCard,
  countryLabel,
  formatDay,
} from '../../components/stats';
import { formErrorMessage } from '../../modules/forms/form-errors';
import type { Route } from './+types/responses';

export const ssr = false;

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Responses - Kurz' }];
}

const PERIODS: { label: string; value: FormSummaryPeriod }[] = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: 'All time', value: 'all' },
];

function formatAnswer(value: FormResponse['answers'][number]['value']) {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function FormResponsesPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: form, error } = useGetForm(id);
  const [days, setDays] = useState<FormSummaryPeriod>(30);
  const [open, setOpen] = useState<FormResponse | null>(null);
  const summary = useGetFormSummary(id, days);
  const responses = useGetFormResponses(id);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getFormResponsesKey(id) });
    queryClient.invalidateQueries({ queryKey: ['form-summary', id] });
    queryClient.invalidateQueries({ queryKey: getFormKey(id) });
    queryClient.invalidateQueries({ queryKey: getFormsKey });
  };
  const onError = (failure: unknown) =>
    notifications.show({ title: 'Error', message: formErrorMessage(failure), color: 'red' });

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
        <Alert title="Failed to load form">We could not load this form.</Alert>
      </PageContainer>
    );
  }

  const rows = responses.data?.pages.flatMap(page => page.response) ?? [];
  const stats = summary.data;

  const confirmDeleteOne = (response: FormResponse) =>
    modals.openConfirmModal({
      title: 'Delete this response?',
      centered: true,
      children: <p className="text-sm">It will be deleted for good. This cannot be undone.</p>,
      labels: { confirm: 'Delete response', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: () => removeOne({ formId: id, responseId: response.id }),
    });

  const confirmDeleteAll = () =>
    modals.openConfirmModal({
      title: 'Delete all responses?',
      centered: true,
      children: (
        <p className="text-sm">
          All {form?.responses_count ?? 0} responses will be deleted for good.
        </p>
      ),
      labels: { confirm: 'Delete all', cancel: 'Keep them' },
      confirmProps: { color: 'red' },
      onConfirm: () => removeAll(id),
    });

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate(`/app/forms/${id}`)}
        >
          {form?.title ?? 'Form'}
        </Button>
        <Button
          variant="subtle"
          color="red"
          leftSection={<IconTrash size={16} />}
          disabled={!form || form.responses_count === 0}
          onClick={confirmDeleteAll}
        >
          Delete all responses
        </Button>
      </div>

      <Tabs defaultValue="summary" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="summary">Summary</Tabs.Tab>
          <Tabs.Tab value="responses">
            Responses {form ? `(${form.responses_count})` : ''}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="summary">
          <div className="mb-4 flex justify-end">
            <SegmentedControl
              value={String(days)}
              onChange={value => setDays(value === 'all' ? 'all' : (Number(value) as FormSummaryPeriod))}
              data={PERIODS.map(period => ({ label: period.label, value: String(period.value) }))}
            />
          </div>
          {!stats ? (
            <div className="h-40 animate-pulse rounded-lg bg-muted" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Views" value={stats.funnel.views} hint={`${stats.funnel.unique_views} unique`} />
                <StatCard label="Started" value={stats.funnel.starts} />
                <StatCard label="Completed" value={stats.funnel.completions} />
                <StatCard
                  label="Completion rate"
                  value={stats.funnel.completion_rate === null ? '—' : `${Math.round(stats.funnel.completion_rate * 100)}%`}
                />
              </div>
              <Card className="p-5">
                <h2 className="mb-4 text-sm font-semibold">Views and responses</h2>
                <AreaChart
                  h={200}
                  data={stats.timeline.map(day => ({ ...day, day: formatDay(day.date) }))}
                  dataKey="day"
                  series={[
                    { name: 'views', label: 'Views', color: 'gray.6' },
                    { name: 'responses', label: 'Responses', color: 'brand.5' },
                  ]}
                  curveType="monotone"
                  withDots={false}
                  gridAxis="x"
                  tickLine="none"
                  yAxisProps={{ allowDecimals: false, width: 32 }}
                />
              </Card>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <BarList title="Where respondents came from" items={stats.audience.sources.map(b => ({ name: b.name, value: b.count }))} />
                <BarList title="Countries" items={stats.audience.countries.map(b => ({ name: b.name, value: b.count }))} label={item => countryLabel(item.name)} />
                <BarList title="Devices" items={stats.audience.devices.map(b => ({ name: b.name, value: b.count }))} />
                <BarList title="Browsers" items={stats.audience.browsers.map(b => ({ name: b.name, value: b.count }))} />
              </div>
              <h2 className="pt-2 text-sm font-semibold">Questions</h2>
              {stats.fields.map(field => (
                <FieldSummaryCard key={field.id} field={field} />
              ))}
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="responses">
          {responses.isLoading && <div className="h-24 animate-pulse rounded-lg bg-muted" />}
          {!responses.isLoading && rows.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No responses yet. Share the form link to start collecting them.
            </Card>
          )}
          <div className="space-y-2">
            {rows.map(response => (
              <button
                key={response.id}
                type="button"
                onClick={() => setOpen(response)}
                className="block w-full text-left"
              >
                <Card className="p-4 transition-colors hover:border-primary/40">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium">
                      {formatAnswer(response.answers[0]?.value ?? null)}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatWhen(response.submitted_at)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[response.source, response.platform, response.browser, response.country && countryLabel(response.country)]
                      .filter(Boolean)
                      .map(tag => (
                        <Badge key={tag} size="xs" variant="light" color="gray">
                          {tag}
                        </Badge>
                      ))}
                  </div>
                </Card>
              </button>
            ))}
          </div>
          {responses.hasNextPage && (
            <div className="mt-4 text-center">
              <Button variant="default" loading={responses.isFetchingNextPage} onClick={() => responses.fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </Tabs.Panel>
      </Tabs>

      <Drawer opened={!!open} onClose={() => setOpen(null)} position="right" title="Response" size="md">
        {open && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">{formatWhen(open.submitted_at)}</p>
            {open.answers.map(answer => (
              <div key={answer.id}>
                <p className="text-xs font-medium text-muted-foreground">{answer.label}</p>
                <p className="mt-0.5 whitespace-pre-line text-sm">{formatAnswer(answer.value)}</p>
              </div>
            ))}
            <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={() => confirmDeleteOne(open)}>
              Delete response
            </Button>
          </div>
        )}
      </Drawer>
    </PageContainer>
  );
}

function FieldSummaryCard({ field }: { field: FormFieldSummary }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold">{field.label}</p>
      <p className="mb-3 text-xs text-muted-foreground">{field.answered} answered</p>
      {field.choices && (
        <BarList title="" items={field.choices.map(choice => ({ name: choice.label, value: choice.count }))} />
      )}
      {field.distribution && (
        <>
          <p className="mb-2 text-sm">Average: {field.average ?? '—'}</p>
          <BarList title="" items={field.distribution.map(point => ({ name: String(point.rating), value: point.count }))} />
        </>
      )}
      {field.type === 'yes_no' && (
        <p className="text-sm">
          Yes {field.yes ?? 0} · No {field.no ?? 0}
        </p>
      )}
      {field.type === 'number' && field.average != null && (
        <p className="text-sm">
          Min {field.min} · Average {field.average} · Max {field.max}
        </p>
      )}
      {field.type === 'date' && field.first && (
        <p className="text-sm">
          From {field.first} to {field.last}
        </p>
      )}
      {field.samples && field.samples.length > 0 && (
        <ul className="space-y-1 text-sm">
          {field.samples.map((sample, index) => (
            <li key={index} className="truncate rounded-md bg-muted/50 px-2.5 py-1.5">
              {sample}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
