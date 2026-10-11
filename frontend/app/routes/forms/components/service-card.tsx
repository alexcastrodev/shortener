import { ActionIcon, Button } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  serviceProblem,
  serviceSummary,
  type SummaryWords,
} from '@internal/booking';
import { formatNumber } from '../../../i18n/format';
import type {
  BookingForm,
  DayLabels,
  EditorMode,
} from './booking-modes/editor-mode';

const money = (amount: number, currency: string) => {
  try {
    return formatNumber(amount, {
      style: 'currency',
      currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${amount} ${currency}`;
  }
};

type Props = {
  form: BookingForm;
  editor: EditorMode;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  dayLabels: DayLabels;
};

export function ServiceCard({
  form,
  editor,
  index,
  expanded,
  onToggle,
  onRemove,
  dayLabels,
}: Props) {
  const { t } = useTranslation('booking');
  const id = useId();
  const service = form.values.services[index];
  const words = editor.words(t);
  const group = editor.mode.groupOf(form.values, service);
  const scheduled = editor.mode.scheduled(service);
  const problem = scheduled ? serviceProblem(service) : null;

  const summaryWords: SummaryWords = {
    minutes: count => t('gen_step_minutes', { count }),
    price: money,
    unlimited: t('summary_unlimited'),
    places: count => t('summary_places', { count }),
    also: list => t('summary_also', { list }),
    monthly: detail =>
      detail ? t('summary_monthly_price', { detail }) : t('summary_monthly'),
    allowance: (count, per) =>
      per === 'week'
        ? t('summary_allowance_week', { count })
        : t('summary_allowance_month', { count }),
    times: count => t('summary_times', { count }),
    ownTimes: days => t('summary_own_times', { days }),
    day: day => dayLabels[day],
  };
  const { details, schedule } = serviceSummary(service, summaryWords);

  const removeLabel = words.remove(service.name.trim() || words.unnamed);

  const border = expanded
    ? 'border-primary'
    : problem
      ? 'border-red-500/70'
      : 'border-border';

  return (
    <div
      id={`service-${service.key}`}
      className={`rounded-lg border ${border}`}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p
            id={`${id}-title`}
            className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium"
          >
            <span className="break-words">
              {service.name.trim() || words.unnamed}
            </span>
            {group !== undefined && (
              <span className="text-xs font-normal text-muted-foreground">
                {group}
              </span>
            )}
          </p>
          <p className="break-words text-xs text-muted-foreground">{details}</p>
          {problem ? (
            <p className="text-xs text-red-500">
              {problem === 'days' ? t('error_days') : t('error_times')}
            </p>
          ) : (
            scheduled && (
              <p className="break-words text-xs text-muted-foreground">
                {schedule}
              </p>
            )
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="subtle"
            size="compact-sm"
            aria-expanded={expanded}
            aria-controls={`${id}-panel`}
            aria-describedby={`${id}-title`}
            onClick={onToggle}
          >
            {expanded ? t('sec_close') : t('sec_edit')}
          </Button>
          <ActionIcon
            variant="subtle"
            color="red"
            aria-label={removeLabel}
            title={removeLabel}
            onClick={onRemove}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </div>
      </div>
      {expanded && (
        <div
          id={`${id}-panel`}
          className="flex flex-col gap-5 border-t border-border p-4"
        >
          <editor.ItemFields form={form} index={index} dayLabels={dayLabels} />
        </div>
      )}
    </div>
  );
}
