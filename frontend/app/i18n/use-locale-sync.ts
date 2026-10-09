import { useEffect } from 'react';
import { useUpdateProfile } from '@internal/core/actions/update-profile/update-profile.hook';
import { useUserState } from '@internal/core/states/use-user-state';
import type { User } from '@internal/core/types/User';
import i18n from './index';
import { LOCALE_COOKIE, localeToSave, readCookie, resolveLocale, type Locale } from './locales';

const ONE_YEAR = 60 * 60 * 24 * 365;
const saving = new Set<string>();

export function applyLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
  document.documentElement.lang = locale;
  void i18n.changeLanguage(locale);
}

export function useLocaleSync() {
  const preference = useUserState(state => state.user?.locale);

  useEffect(() => {
    const locale = resolveLocale({
      cookie: readCookie(document.cookie),
      preference,
      acceptLanguage: navigator.languages?.join(',') ?? navigator.language,
    });
    document.documentElement.lang = locale;
    if (i18n.language !== locale) void i18n.changeLanguage(locale);
  }, [preference]);
}

export function useSaveMissingLocale(user: User | undefined) {
  const setUser = useUserState(state => state.setUser);
  const { mutate } = useUpdateProfile({ onSuccess: setUser });

  useEffect(() => {
    const locale = user && localeToSave(user.locale, i18n.language);
    if (!user || !locale || saving.has(user.id)) return;
    saving.add(user.id);
    mutate({ locale });
  }, [user, mutate]);
}
