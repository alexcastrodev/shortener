import { Checkbox, NativeSelect, NumberInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { BookingForm } from './booking-modes/editor-mode';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'BRL', 'CHF'];

export function ServiceBasics({
  form,
  index,
}: {
  form: BookingForm;
  index: number;
}) {
  const { t } = useTranslation('booking');
  const service = form.values.services[index];
  const currencies = CURRENCIES.includes(service.currency)
    ? CURRENCIES
    : [service.currency, ...CURRENCIES];

  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-3">
      <NumberInput
        label={t('service_duration')}
        min={5}
        max={600}
        allowDecimal={false}
        rightSection={
          <span className="text-xs text-muted-foreground">{t('unit_min')}</span>
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
  );
}
