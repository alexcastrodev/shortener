import {
  ActionIcon,
  Button,
  Chip,
  Group,
  SegmentedControl,
  Stack,
  TextInput,
} from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TIME,
  blankException,
  newKey,
  type ExceptionValues,
  type Values,
} from '../../../modules/forms/booking-config.ts';
import { summarizeExceptions } from '../../../modules/forms/rules-summary.ts';
import { SummarySection, useOpenOnErrors } from './summary-section';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function shortDate(iso: string, locale: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  const piece = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' })
      .format(date)
      .replace(/\.$/, '');
  const weekday = piece({ weekday: 'short' }).slice(0, 3);
  const year = piece({ year: 'numeric' });
  const suffix = year === String(new Date().getFullYear()) ? '' : ` ${year}`;
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${piece({ day: 'numeric' })} ${piece({ month: 'short' })}${suffix}`;
}

type DraftErrors = { from?: string; to?: string; times?: string };

export function ExceptionsSection({
  form,
}: {
  form: UseFormReturnType<Values>;
}) {
  const { t, i18n } = useTranslation('booking');
  const savedServices = form.values.services.filter(service => service.id);
  const [open, setOpen] = useOpenOnErrors(form.errors, key =>
    key.startsWith('exceptions')
  );
  const [draft, setDraft] = useState<ExceptionValues>(blankException);
  const [draftErrors, setDraftErrors] = useState<DraftErrors>({});

  const date = (iso: string) => shortDate(iso, i18n.language);
  const patch = (changes: Partial<ExceptionValues>) =>
    setDraft(current => ({ ...current, ...changes }));

  const summary = summarizeExceptions(form.values.exceptions, {
    none: t('exc_sum_none'),
    closed: t('exc_sum_closed'),
    special: times => t('exc_sum_special', { times }),
    more: count => t('exc_sum_more', { count }),
    date,
  });

  const add = () => {
    const times = draft.times
      .map(time => ({ ...time, value: time.value.trim() }))
      .filter(time => TIME.test(time.value));
    const errors: DraftErrors = {};
    if (!DATE.test(draft.from)) errors.from = t('err_exc_from');
    if (draft.to && draft.from && draft.to < draft.from) {
      errors.to = t('err_exc_range');
    }
    if (draft.kind === 'special' && times.length === 0) {
      errors.times = t('err_exc_times');
    }
    setDraftErrors(errors);
    if (Object.keys(errors).length > 0) return;
    form.insertListItem('exceptions', {
      ...draft,
      key: newKey(),
      times,
      note: draft.note.trim(),
    });
    setDraft(blankException());
  };

  return (
    <SummarySection
      title={t('exc_title')}
      summary={summary}
      open={open}
      onToggle={() => setOpen(current => !current)}
    >
      <Stack gap="md">
        <p className="text-xs text-muted-foreground">{t('exc_hint')}</p>
        {form.values.exceptions.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('exc_empty')}</p>
        )}
        {form.values.exceptions.map((item, index) => {
          const range =
            item.to && item.to !== item.from
              ? `${date(item.from)} – ${date(item.to)}`
              : date(item.from);
          const names = savedServices
            .filter(service => item.serviceIds.includes(service.id!))
            .map(service => service.name)
            .join(', ');
          const detail = [item.note.trim(), names].filter(Boolean).join(' · ');
          const times = item.times
            .map(time => time.value)
            .filter(value => TIME.test(value))
            .sort()
            .join(', ');
          return (
            <div
              key={item.key}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="break-words text-sm">{range}</p>
                {detail && (
                  <p className="break-words text-xs text-muted-foreground">
                    {detail}
                  </p>
                )}
              </div>
              <Group gap="xs" wrap="nowrap">
                <span className="text-xs text-muted-foreground">
                  {item.kind === 'closed' ? t('exc_kind_closed') : times}
                </span>
                <Button
                  variant="subtle"
                  color="red"
                  size="compact-xs"
                  aria-label={t('exc_remove_item', { date: range })}
                  onClick={() => form.removeListItem('exceptions', index)}
                >
                  {t('exc_remove')}
                </Button>
              </Group>
            </div>
          );
        })}
        <div className="rounded-lg border border-dashed border-border p-3">
          <Stack gap="sm">
            <div>
              <p className="mb-1 text-sm">{t('exc_kind')}</p>
              <SegmentedControl
                size="xs"
                value={draft.kind}
                onChange={value => {
                  patch({ kind: value as 'closed' | 'special' });
                  setDraftErrors(errors => ({ ...errors, times: undefined }));
                }}
                data={[
                  { value: 'closed', label: t('exc_kind_closed') },
                  { value: 'special', label: t('exc_kind_special') },
                ]}
              />
            </div>
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              <TextInput
                type="date"
                label={t('exc_from')}
                value={draft.from}
                error={draftErrors.from}
                onChange={event => {
                  patch({ from: event.currentTarget.value });
                  setDraftErrors(errors => ({ ...errors, from: undefined }));
                }}
              />
              <TextInput
                type="date"
                label={t('exc_to')}
                description={t('exc_to_hint')}
                value={draft.to}
                error={draftErrors.to}
                onChange={event => {
                  patch({ to: event.currentTarget.value });
                  setDraftErrors(errors => ({ ...errors, to: undefined }));
                }}
              />
            </div>
            {draft.kind === 'special' && (
              <div>
                <p className="mb-1 text-sm font-medium">{t('exc_times')}</p>
                <Group gap="xs">
                  {draft.times.map(time => (
                    <Group key={time.key} gap={2} wrap="nowrap">
                      <TextInput
                        type="time"
                        size="xs"
                        aria-label={t('exc_times')}
                        value={time.value}
                        onChange={event => {
                          const value = event.currentTarget.value;
                          patch({
                            times: draft.times.map(item =>
                              item.key === time.key ? { ...item, value } : item
                            ),
                          });
                          setDraftErrors(errors => ({
                            ...errors,
                            times: undefined,
                          }));
                        }}
                      />
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={t('exc_remove_time', { time: time.value })}
                        onClick={() =>
                          patch({
                            times: draft.times.filter(
                              item => item.key !== time.key
                            ),
                          })
                        }
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    </Group>
                  ))}
                  <Button
                    variant="subtle"
                    size="compact-xs"
                    leftSection={<IconPlus size={12} />}
                    onClick={() =>
                      patch({
                        times: [...draft.times, { key: newKey(), value: '' }],
                      })
                    }
                  >
                    {t('exc_add_time')}
                  </Button>
                </Group>
                {draftErrors.times && (
                  <p className="mt-1 text-xs text-red-500">
                    {draftErrors.times}
                  </p>
                )}
              </div>
            )}
            <div>
              <p className="mb-1 text-sm font-medium">{t('exc_services')}</p>
              {savedServices.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t('exc_all_services')}
                </p>
              ) : (
                <>
                  <Chip.Group
                    multiple
                    value={draft.serviceIds}
                    onChange={value => patch({ serviceIds: value })}
                  >
                    <Group gap={6}>
                      {savedServices.map(service => (
                        <Chip key={service.key} value={service.id!} size="xs">
                          {service.name}
                        </Chip>
                      ))}
                    </Group>
                  </Chip.Group>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {draft.serviceIds.length === 0
                      ? t('exc_all_services')
                      : t('exc_services_hint')}
                  </p>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <TextInput
                className="min-w-0 flex-1"
                label={t('exc_note')}
                maxLength={200}
                value={draft.note}
                onChange={event => patch({ note: event.currentTarget.value })}
              />
              <Button variant="light" color="brand" onClick={add}>
                {t('exc_add')}
              </Button>
            </div>
          </Stack>
        </div>
      </Stack>
    </SummarySection>
  );
}
