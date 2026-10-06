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
import { IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  blankException,
  newKey,
  type Values,
} from '../../../modules/forms/booking-config.ts';

export function ExceptionsSection({
  form,
}: {
  form: UseFormReturnType<Values>;
}) {
  const { t } = useTranslation('booking');
  const savedServices = form.values.services.filter(service => service.id);

  return (
    <Stack gap="sm">
      <div>
        <p className="text-sm font-medium">{t('exc_title')}</p>
        <p className="text-xs text-muted-foreground">{t('exc_hint')}</p>
      </div>
      {form.values.exceptions.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          {t('exc_empty')}
        </p>
      )}
      {form.values.exceptions.map((item, index) => (
        <div key={item.key} className="rounded-lg border border-border p-3">
          <Stack gap="sm">
            <Group justify="space-between" align="flex-end" wrap="nowrap">
              <div>
                <p className="mb-1 text-sm">{t('exc_kind')}</p>
                <SegmentedControl
                  size="xs"
                  value={item.kind}
                  onChange={value =>
                    form.setFieldValue(
                      `exceptions.${index}.kind`,
                      value as 'closed' | 'special'
                    )
                  }
                  data={[
                    { value: 'closed', label: t('exc_kind_closed') },
                    { value: 'special', label: t('exc_kind_special') },
                  ]}
                />
              </div>
              <ActionIcon
                variant="subtle"
                color="red"
                size="lg"
                aria-label={t('exc_remove')}
                onClick={() => form.removeListItem('exceptions', index)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
            <Group grow align="flex-start">
              <TextInput
                type="date"
                label={t('exc_from')}
                {...form.getInputProps(`exceptions.${index}.from`)}
              />
              <TextInput
                type="date"
                label={t('exc_to')}
                description={t('exc_to_hint')}
                {...form.getInputProps(`exceptions.${index}.to`)}
              />
            </Group>
            {item.kind === 'special' && (
              <div>
                <p className="mb-1 text-sm font-medium">{t('exc_times')}</p>
                <Group gap="xs">
                  {item.times.map((time, timeIndex) => (
                    <Group key={time.key} gap={2} wrap="nowrap">
                      <TextInput
                        type="time"
                        size="xs"
                        aria-label={t('exc_times')}
                        {...form.getInputProps(
                          `exceptions.${index}.times.${timeIndex}.value`
                        )}
                      />
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={t('exc_remove_time', { time: time.value })}
                        onClick={() =>
                          form.removeListItem(
                            `exceptions.${index}.times`,
                            timeIndex
                          )
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
                      form.insertListItem(`exceptions.${index}.times`, {
                        key: newKey(),
                        value: '',
                      })
                    }
                  >
                    {t('exc_add_time')}
                  </Button>
                </Group>
                {typeof form.errors[`exceptions.${index}.times`] ===
                  'string' && (
                  <p className="mt-1 text-xs text-red-500">
                    {form.errors[`exceptions.${index}.times`]}
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
                    value={item.serviceIds}
                    onChange={value =>
                      form.setFieldValue(
                        `exceptions.${index}.serviceIds`,
                        value
                      )
                    }
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
                    {item.serviceIds.length === 0
                      ? t('exc_all_services')
                      : t('exc_services_hint')}
                  </p>
                </>
              )}
            </div>
            <TextInput
              label={t('exc_note')}
              maxLength={200}
              {...form.getInputProps(`exceptions.${index}.note`)}
            />
          </Stack>
        </div>
      ))}
      <div>
        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => form.insertListItem('exceptions', blankException())}
        >
          {t('exc_add')}
        </Button>
      </div>
    </Stack>
  );
}
