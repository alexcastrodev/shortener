import { Chip, Group, TextInput } from '@mantine/core';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ExtraDurations } from '../../extra-durations';
import { MonthlyOffer } from '../../monthly-offer';
import { ScheduleFields } from '../../schedule-fields';
import { ServiceBasics } from '../../service-basics';
import type { ItemFieldsProps } from '../editor-mode';

export function ServicesItemFields({ form, index, dayLabels }: ItemFieldsProps) {
  const { t } = useTranslation('booking');
  const id = useId();
  const service = form.values.services[index];
  const { categories } = form.values;

  return (
    <>
      <TextInput
        label={t('service_name')}
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
      <ServiceBasics form={form} index={index} />
      <ScheduleFields
        form={form}
        path={`services.${index}`}
        duration={Number(service.duration) || 60}
        dayLabels={dayLabels}
      />
      <ExtraDurations form={form} index={index} />
      <MonthlyOffer form={form} index={index} />
    </>
  );
}
