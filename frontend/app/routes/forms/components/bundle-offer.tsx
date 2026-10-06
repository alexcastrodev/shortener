import { Group, NumberInput, Switch } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import type { Values } from '../../../modules/forms/booking-config.ts';

export function BundleOffer({
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
        label={t('bundle_switch')}
        description={t('bundle_hint')}
        checked={service.bundle}
        onChange={event =>
          form.setFieldValue(
            `services.${index}.bundle`,
            event.currentTarget.checked
          )
        }
      />
      {service.bundle && (
        <>
          <Group grow mt="xs" align="flex-start">
            <NumberInput
              label={t('bundle_take')}
              min={2}
              max={31}
              allowDecimal={false}
              {...form.getInputProps(`services.${index}.bundleTake`)}
            />
            <NumberInput
              label={t('bundle_pay')}
              min={1}
              max={30}
              allowDecimal={false}
              {...form.getInputProps(`services.${index}.bundlePay`)}
            />
          </Group>
          {service.bundleTake !== '' && service.bundlePay !== '' && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('bundle_example', {
                take: service.bundleTake,
                pay: service.bundlePay,
              })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
