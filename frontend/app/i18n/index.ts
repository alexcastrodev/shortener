import i18n, { type ReadCallback } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, type Locale } from './locales';
import menu from './en/menu.json';
import home from './en/home.json';
import dashboard from './en/dashboard.json';
import admin from './en/admin.json';
import links from './en/links.json';
import auth from './en/auth.json';
import pages from './en/pages.json';
import forms from './en/forms.json';
import respond from './en/respond.json';
import settings from './en/settings.json';
import account from './en/account.json';
import oauth from './en/oauth.json';
import responses from './en/responses.json';
import templates from './en/templates.json';
import landing from './en/landing.json';
import notifications from './en/notifications.json';
import manage from './en/manage.json';
import booking from './en/booking.json';
import agenda from './en/agenda.json';
import notices from './en/notices.json';
import appointments from './en/appointments.json';
import cover from './en/cover.json';
import verify from './en/verify.json';
import waitlist from './en/waitlist.json';
import unlock from './en/unlock.json';
import calendarFeed from './en/calendarFeed.json';
import decide from './en/decide.json';

export const resources = {
  en: { menu, home, dashboard, admin, links, auth, pages, forms, respond, settings, account, oauth, responses, templates, landing, notifications, manage, decide, booking, agenda, notices, appointments, cover, calendarFeed, verify, waitlist, unlock },
} as const;

i18n
  .use({
    type: 'backend',
    read(language: string, namespace: string, callback: ReadCallback) {
      import('./translations').then(
        ({ default: files }) => callback(null, files[`./${language}/${namespace}.json`]),
        error => callback(error, null)
      );
    },
  })
  .use(initReactI18next)
  .init({
    resources,
    partialBundledLanguages: true,
    ns: Object.keys(resources.en),
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
