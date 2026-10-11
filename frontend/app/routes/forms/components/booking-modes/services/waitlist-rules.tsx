import { Stack, Switch } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { TimeoutInput } from '../../timeout-input';
import type { RulesExtrasProps } from '../editor-mode';

export function WaitlistRules({ form }: RulesExtrasProps) {
  const { t } = useTranslation('booking');

  return (
    <Stack gap="xs">
      <Switch
        label={t('waitlist')}
        description={t('waitlist_hint')}
        checked={form.values.waitlist}
        onChange={event =>
          form.setFieldValue('waitlist', event.currentTarget.checked)
        }
      />
      {form.values.waitlist && (
        <TimeoutInput
          label={t('waitlist_confirm')}
          hint={t('waitlist_confirm_range')}
          min={15}
          max={4320}
          minutes={form.values.waitlist_confirm_minutes}
          error={form.errors.waitlist_confirm_minutes as string | undefined}
          onChange={value =>
            form.setFieldValue('waitlist_confirm_minutes', value)
          }
        />
      )}
    </Stack>
  );
}
