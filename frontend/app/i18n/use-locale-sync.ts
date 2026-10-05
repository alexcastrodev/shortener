import { useEffect } from 'react';
import i18n from './index';
import { readCookie, resolveLocale } from './locales';

export function useLocaleSync() {
  useEffect(() => {
    const locale = resolveLocale({
      cookie: readCookie(document.cookie),
      acceptLanguage: navigator.languages?.join(',') ?? navigator.language,
    });
    document.documentElement.lang = locale;
    if (i18n.language !== locale) void i18n.changeLanguage(locale);
  }, []);
}
