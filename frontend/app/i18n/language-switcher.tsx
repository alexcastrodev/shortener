import { NativeSelect } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Card } from '@internal/ui';
import { useUpdateProfile } from '@internal/core/actions/update-profile/update-profile.hook';
import { useUserState } from '@internal/core/states/use-user-state';
import { LOCALES, isLocale, type Locale } from './locales';
import { applyLocale } from './use-locale-sync';

const NAMES: Record<Locale, string> = {
  en: 'English',
  'pt-PT': 'Português (Portugal)',
};

export function LanguageSwitcher({ size = 'xs' }: { size?: 'xs' | 'sm' }) {
  const { t, i18n } = useTranslation('settings');
  const user = useUserState(state => state.user);
  const setUser = useUserState(state => state.setUser);
  const update = useUpdateProfile({ onSuccess: setUser });
  const current = isLocale(i18n.language) ? i18n.language : 'en';

  return (
    <NativeSelect
      aria-label={t('language')}
      size={size}
      w={size === 'sm' ? 220 : 170}
      value={current}
      data={LOCALES.map(locale => ({ value: locale, label: NAMES[locale] }))}
      onChange={event => {
        const next = event.currentTarget.value;
        if (!isLocale(next)) return;
        applyLocale(next);
        if (user) update.mutate({ locale: next });
      }}
    />
  );
}

export function LanguageCard() {
  const { t } = useTranslation('settings');

  return (
    <Card className="flex items-center justify-between gap-4 p-5 sm:p-6">
      <p className="font-semibold text-foreground">{t('language')}</p>
      <LanguageSwitcher size="sm" />
    </Card>
  );
}
