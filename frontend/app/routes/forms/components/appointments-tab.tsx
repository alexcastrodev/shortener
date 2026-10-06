import { Button, Menu, Select, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Card } from '@internal/ui';
import { exportFormAppointments } from '@internal/core/actions/export-form-appointments/export-form-appointments.service';
import { useGetFormAppointments } from '@internal/core/actions/get-form-appointments/get-form-appointments.hook';
import type { AppointmentStatus } from '@internal/core/actions/get-form-appointments/get-form-appointments.types';
import { formatDateTime } from '../../../i18n/format';
import {
  STATUS_OPTIONS,
  dateRangeProblem,
  emptyFilters,
  exportName,
  hasFilters,
  toFilters,
  type FilterValues,
} from '../../../modules/appointments-tab/appointment-filters.ts';

export function AppointmentsTab({
  formId,
  title,
  timeZone,
}: {
  formId: number | string;
  title: string;
  timeZone: string;
}) {
  const { t } = useTranslation('appointments');
  const [values, setValues] = useState<FilterValues>(emptyFilters);
  const [exporting, setExporting] = useState(false);
  const problem = dateRangeProblem(values);
  const filters = toFilters(problem ? { ...values, to: '' } : values);
  const {
    data,
    error,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useGetFormAppointments(formId, filters, true);
  const rows = data?.pages.flatMap(page => page.appointments) ?? [];

  const statusLabel = (status: AppointmentStatus) => {
    switch (status) {
      case 'pending':
        return t('status_pending');
      case 'confirmed':
        return t('status_confirmed');
      case 'cancelled':
        return t('status_cancelled');
      case 'declined':
        return t('status_declined');
      case 'expired':
        return t('status_expired');
      default:
        return t('status_rescheduled');
    }
  };

  const download = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      const blob = await exportFormAppointments(formId, filters, format);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = exportName(title, format);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (failure) {
      const status = (failure as { response?: { status?: number } })?.response
        ?.status;
      notifications.show({
        color: 'red',
        message: status === 413 ? t('export_too_large') : t('export_failed'),
      });
    } finally {
      setExporting(false);
    }
  };

  const set = (patch: Partial<FilterValues>) =>
    setValues(current => ({ ...current, ...patch }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <TextInput
          className="min-w-52 flex-1"
          aria-label={t('search')}
          placeholder={t('search')}
          leftSection={<IconSearch size={16} />}
          value={values.q}
          onChange={event => set({ q: event.currentTarget.value })}
        />
        <Select
          aria-label={t('status')}
          placeholder={t('all_statuses')}
          clearable
          data={STATUS_OPTIONS.map(status => ({
            value: status,
            label: statusLabel(status),
          }))}
          value={values.status || null}
          onChange={value =>
            set({ status: (value as AppointmentStatus | null) ?? '' })
          }
        />
        <TextInput
          type="date"
          label={t('from')}
          value={values.from}
          onChange={event => set({ from: event.currentTarget.value })}
        />
        <TextInput
          type="date"
          label={t('to')}
          value={values.to}
          error={problem ? t('range_problem') : undefined}
          onChange={event => set({ to: event.currentTarget.value })}
        />
        {hasFilters(values) && (
          <Button
            variant="subtle"
            size="xs"
            onClick={() => setValues(emptyFilters)}
          >
            {t('clear')}
          </Button>
        )}
        <Menu position="bottom-end">
          <Menu.Target>
            <Button
              color="brand"
              loading={exporting}
              disabled={rows.length === 0}
              leftSection={<IconDownload size={16} />}
            >
              {t('export')}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => download('xlsx')}>
              {t('export_excel')}
            </Menu.Item>
            <Menu.Item onClick={() => download('csv')}>
              {t('export_csv')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>

      {error && <Alert title={t('tab')}>{t('error')}</Alert>}
      {isLoading && <div className="h-40 animate-pulse rounded-lg bg-muted" />}

      {!isLoading && !error && rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {hasFilters(values) ? t('empty_filtered') : t('empty')}
        </p>
      )}

      {rows.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-medium">
                  {t('col_when')}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  {t('col_service')}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  {t('col_client')}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  {t('col_status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-2 whitespace-nowrap">
                    {formatDateTime(row.starts_at, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone,
                    })}
                  </td>
                  <td className="px-4 py-2">{row.service_name}</td>
                  <td className="px-4 py-2">
                    <p className="font-medium">
                      {row.client_name ?? t('no_name')}
                    </p>
                    {row.client_email && (
                      <p className="text-xs text-muted-foreground">
                        {row.client_email}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <p>{statusLabel(row.status)}</p>
                    {row.cancel_reason && (
                      <p className="text-xs text-muted-foreground">
                        {t('reason', { reason: row.cancel_reason })}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {hasNextPage && (
        <div className="text-center">
          <Button
            variant="default"
            loading={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            {t('load_more')}
          </Button>
        </div>
      )}
    </div>
  );
}
