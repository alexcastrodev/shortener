import { ActionIcon, Button, NumberInput, Tooltip } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  EXTRA_DURATIONS_MAX,
  newKey,
  type Values,
} from '@internal/booking';

export function ExtraDurations({
  form,
  index,
}: {
  form: UseFormReturnType<Values>;
  index: number;
}) {
  const { t } = useTranslation('booking');
  const service = form.values.services[index];
  const priced = service.price !== '';

  return (
    <div>
      <p className="mb-1 text-sm font-medium">{t('extra_durations')}</p>
      <p className="mb-2 text-xs text-muted-foreground">
        {t('extra_durations_hint')}
      </p>
      <div className="flex flex-col gap-2">
        {service.extraDurations.map((item, at) => (
          <div key={item.key} className="flex items-start gap-2">
            <NumberInput
              className="flex-1"
              aria-label={t('service_duration')}
              min={5}
              max={600}
              allowDecimal={false}
              rightSection={
                <span className="text-xs text-muted-foreground">
                  {t('unit_min')}
                </span>
              }
              {...form.getInputProps(
                `services.${index}.extraDurations.${at}.duration`
              )}
            />
            <Tooltip
              label={t('extra_price_needs_main')}
              disabled={priced}
              events={{ hover: true, focus: true, touch: true }}
            >
              <div className="flex-1">
                <NumberInput
                  aria-label={t('service_price')}
                  min={0}
                  decimalScale={2}
                  disabled={!priced}
                  rightSectionWidth={48}
                  rightSection={
                    <span className="text-xs text-muted-foreground">
                      {service.currency}
                    </span>
                  }
                  {...form.getInputProps(
                    `services.${index}.extraDurations.${at}.price`
                  )}
                />
              </div>
            </Tooltip>
            <ActionIcon
              mt={4}
              variant="subtle"
              color="gray"
              aria-label={t('extra_duration_remove')}
              onClick={() =>
                form.removeListItem(`services.${index}.extraDurations`, at)
              }
            >
              <IconX size={14} />
            </ActionIcon>
          </div>
        ))}
      </div>
      {service.extraDurations.length < EXTRA_DURATIONS_MAX && (
        <Button
          mt={6}
          variant="subtle"
          size="compact-xs"
          leftSection={<IconPlus size={12} />}
          onClick={() =>
            form.insertListItem(`services.${index}.extraDurations`, {
              key: newKey(),
              duration: '',
              price: '',
            })
          }
        >
          {t('extra_durations_add')}
        </Button>
      )}
    </div>
  );
}
