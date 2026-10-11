import { NumberInput, SegmentedControl, Switch } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { ALLOWANCE_MAX, type Values } from '@internal/booking';

export function MonthlyOffer({
  form,
  index,
}: {
  form: UseFormReturnType<Values>;
  index: number;
}) {
  const { t } = useTranslation('booking');
  const service = form.values.services[index];

  return (
    <div>
      <Switch
        size="sm"
        label={t('monthly_switch')}
        description={t('monthly_hint')}
        checked={service.monthly}
        onChange={event =>
          form.setFieldValue(
            `services.${index}.monthly`,
            event.currentTarget.checked
          )
        }
      />
      {service.monthly && (
        <NumberInput
          mt="xs"
          label={t('monthly_duration')}
          description={t('monthly_duration_hint')}
          placeholder={service.duration === '' ? undefined : String(service.duration)}
          min={5}
          max={600}
          allowDecimal={false}
          rightSection={
            <span className="text-xs text-muted-foreground">{t('unit_min')}</span>
          }
          {...form.getInputProps(`services.${index}.monthlyDuration`)}
        />
      )}
      {service.monthly && (
        <NumberInput
          mt="xs"
          label={t('monthly_price')}
          description={
            service.price === ''
              ? t('monthly_price_needs_price')
              : t('monthly_price_hint')
          }
          min={0}
          decimalScale={2}
          rightSection={
            <span className="text-xs text-muted-foreground">
              {service.currency}
            </span>
          }
          rightSectionWidth={48}
          {...form.getInputProps(`services.${index}.monthlyPrice`)}
        />
      )}
      {service.monthly && (
        <NumberInput
          mt="xs"
          label={t('monthly_sessions')}
          description={t('monthly_sessions_hint')}
          min={1}
          max={ALLOWANCE_MAX[service.monthlyPer]}
          allowDecimal={false}
          {...form.getInputProps(`services.${index}.monthlySessions`)}
        />
      )}
      {service.monthly && service.monthlySessions !== '' && (
        <SegmentedControl
          mt="xs"
          aria-label={t('monthly_per')}
          data={[
            { value: 'month', label: t('monthly_per_month') },
            { value: 'week', label: t('monthly_per_week') },
          ]}
          value={service.monthlyPer}
          onChange={value =>
            form.setFieldValue(
              `services.${index}.monthlyPer`,
              value as 'month' | 'week'
            )
          }
        />
      )}
    </div>
  );
}
