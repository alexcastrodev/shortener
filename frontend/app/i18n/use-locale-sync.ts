import { useEffect } from 'react';
import { useUserState } from '@internal/core/states/use-user-state';
import i18n from './index';
import { LOCALE_COOKIE, readCookie, resolveLocale, type Locale } from './locales';

const ONE_YEAR = 60 * 60 * 24 * 365;

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
