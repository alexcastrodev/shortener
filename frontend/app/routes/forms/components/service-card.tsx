import {
  Button,
  Checkbox,
  Chip,
  Group,
  NativeSelect,
  NumberInput,
  Switch,
  TextInput,
} from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../../i18n/format';
import {
  DAYS,
  LESSON_DURATION,
  blankSchedule,
  isGrouped,
  type Values,
} from '../../../modules/forms/booking-config.ts';
import {
  serviceProblem,
  serviceSummary,
  type SummaryWords,
} from '../../../modules/forms/service-summary.ts';
import { ExtraDurations } from './extra-durations';
import { MonthlyOffer } from './monthly-offer';
import { ScheduleFields } from './schedule-fields';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'BRL', 'CHF'];

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
  form: UseFormReturnType<Values>;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  dayLabels: Record<(typeof DAYS)[number], string>;
};

export function ServiceCard({
  form,
  index,
  expanded,
  onToggle,
  onRemove,
  dayLabels,
}: Props) {
  const { t } = useTranslation('booking');
  const id = useId();
  const service = form.values.services[index];
  const individual = form.values.mode === 'individual';
  const unnamed = t(individual ? 'lesson_new' : 'service_new');
  const grouped = !individual && isGrouped(form.values);
  const category = grouped
    ? form.values.categories.find(item => item.id === service.categoryId)
    : undefined;
  const scheduled = !individual || service.ownSchedule;
  const problem = scheduled ? serviceProblem(service) : null;

  const words: SummaryWords = {
    minutes: count => t('gen_step_minutes', { count }),
    price: money,
    unlimited: t('summary_unlimited'),
    places: count => t('summary_places', { count }),
    also: list => t('summary_also', { list }),
    monthly: detail =>
      detail ? t('summary_monthly_price', { detail }) : t('summary_monthly'),
    times: count => t('summary_times', { count }),
    ownTimes: days => t('summary_own_times', { days }),
    day: day => dayLabels[day],
  };
  const { details, schedule } = serviceSummary(service, words);

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
              {service.name.trim() || unnamed}
            </span>
            {category && (
              <span className="text-xs font-normal text-muted-foreground">
                {category.name}
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
      </div>
      {expanded && (
        <div
          id={`${id}-panel`}
          className="flex flex-col gap-5 border-t border-border p-4"
        >
          <ServiceFields
            form={form}
            index={index}
            dayLabels={dayLabels}
            individual={individual}
          />
          <div>
            <Button
              variant="subtle"
              color="red"
              size="compact-sm"
              maw="100%"
              h="auto"
              py={4}
              styles={{ label: { whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'left' } }}
              onClick={onRemove}
            >
              {t(individual ? 'lesson_remove' : 'service_remove', {
                name: service.name.trim() || unnamed,
              })}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceFields({
  form,
  index,
  dayLabels,
  individual,
}: {
  form: UseFormReturnType<Values>;
  index: number;
  dayLabels: Record<(typeof DAYS)[number], string>;
  individual: boolean;
}) {
  const { t } = useTranslation('booking');
  const id = useId();
  const service = form.values.services[index];
  const categories = individual ? [] : form.values.categories;
  const currencies = CURRENCIES.includes(service.currency)
    ? CURRENCIES
    : [service.currency, ...CURRENCIES];

  return (
    <>
      <TextInput
        label={t(individual ? 'lesson_name' : 'service_name')}
        {...form.getInputProps(`services.${index}.name`)}
      />
      {categories.length >= 2 && (
        <div role="radiogroup" aria-labelledby={`${id}-category`}>
          <p id={`${id}-category`} className="mb-1 text-sm font-medium">
            {t('service_category')}
          </p>
          <Chip.Group
            value={service.categoryId}
            onChange={value =>
              form.setFieldValue(`services.${index}.categoryId`, value)
            }
          >
            <Group gap={6}>
              {categories.map(item => (
                <Chip
                  key={item.id}
                  value={item.id}
                  size="xs"
                  styles={{
                  root: { maxWidth: '100%' },
                  label: {
                    maxWidth: '100%',
                    height: 'auto',
                    minHeight: 'var(--chip-size)',
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                    textAlign: 'left',
                    paddingBlock: 4,
                  },
                  }}
                >
                  {item.name || t('category_new')}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </div>
      )}
      {categories.length === 1 && (
        <p className="text-xs text-muted-foreground">
          {t('category_one_hint')}
        </p>
      )}
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-3">
        <NumberInput
          label={t('service_duration')}
          min={5}
          max={600}
          allowDecimal={false}
          rightSection={
            <span className="text-xs text-muted-foreground">
              {t('unit_min')}
            </span>
          }
          {...form.getInputProps(`services.${index}.duration`)}
        />
        <div>
          <NumberInput
            label={t('service_capacity')}
            placeholder={t('service_capacity_none')}
            min={1}
            max={1000}
            allowDecimal={false}
            disabled={service.capacity === ''}
            {...form.getInputProps(`services.${index}.capacity`)}
          />
          <Checkbox
            mt={6}
            size="xs"
            styles={{ label: { whiteSpace: 'nowrap', fontSize: '0.6875rem' } }}
            label={t('summary_unlimited')}
            checked={service.capacity === ''}
            onChange={event =>
              form.setFieldValue(
                `services.${index}.capacity`,
                event.currentTarget.checked ? '' : 1
              )
            }
          />
        </div>
        <NumberInput
          label={t('service_price')}
          placeholder={t('optional')}
          min={0}
          decimalScale={2}
          rightSectionWidth={72}
          rightSectionPointerEvents="all"
          rightSection={
            <NativeSelect
              variant="unstyled"
              size="xs"
              aria-label={t('service_currency')}
              data={currencies}
              value={service.currency}
              onChange={event =>
                form.setFieldValue(
                  `services.${index}.currency`,
                  event.currentTarget.value
                )
              }
            />
          }
          {...form.getInputProps(`services.${index}.price`)}
        />
      </div>
      {individual && (
        <Switch
          size="sm"
          label={t('lesson_own_schedule')}
          description={t('lesson_own_schedule_hint')}
          checked={service.ownSchedule}
          onChange={event => {
            const ownSchedule = event.currentTarget.checked;
            form.setFieldValue(`services.${index}`, {
              ...service,
              ownSchedule,
              ...(ownSchedule
                ? blankSchedule(Number(service.duration) || LESSON_DURATION)
                : { days: [], times: [], byDay: {} }),
            });
          }}
        />
      )}
      {(!individual || service.ownSchedule) && (
        <ScheduleFields
          form={form}
          path={`services.${index}`}
          duration={Number(service.duration) || 60}
          dayLabels={dayLabels}
        />
      )}
      <ExtraDurations form={form} index={index} />
      <MonthlyOffer form={form} index={index} />
    </>
  );
}
