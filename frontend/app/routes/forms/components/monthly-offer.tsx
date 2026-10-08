import { NumberInput, Switch } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import type { Values } from '../../../modules/forms/booking-config.ts';

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
    </div>
  );
}
