import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, type Locale } from './locales';
import menu from './en/menu.json';
import home from './en/home.json';
import dashboard from './en/dashboard.json';
import admin from './en/admin.json';
import links from './en/links.json';
import menuPt from './pt-PT/menu.json';
import homePt from './pt-PT/home.json';
import dashboardPt from './pt-PT/dashboard.json';
import adminPt from './pt-PT/admin.json';
import linksPt from './pt-PT/links.json';

export const resources = {
  en: { menu, home, dashboard, admin, links },
  'pt-PT': { menu: menuPt, home: homePt, dashboard: dashboardPt, admin: adminPt, links: linksPt },
} as const;

i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: {
    escapeValue: false,
  },
});

export function activeLocale(): Locale {
  return i18n.resolvedLanguage === 'pt-PT' ? 'pt-PT' : DEFAULT_LOCALE;
}

export default i18n;
