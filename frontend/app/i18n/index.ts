import i18n from 'i18next';
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
import decide from './en/decide.json';
import menuPt from './pt-PT/menu.json';
import homePt from './pt-PT/home.json';
import dashboardPt from './pt-PT/dashboard.json';
import adminPt from './pt-PT/admin.json';
import linksPt from './pt-PT/links.json';
import authPt from './pt-PT/auth.json';
import pagesPt from './pt-PT/pages.json';
import formsPt from './pt-PT/forms.json';
import respondPt from './pt-PT/respond.json';
import settingsPt from './pt-PT/settings.json';
import accountPt from './pt-PT/account.json';
import oauthPt from './pt-PT/oauth.json';
import responsesPt from './pt-PT/responses.json';
import templatesPt from './pt-PT/templates.json';
import landingPt from './pt-PT/landing.json';
import notificationsPt from './pt-PT/notifications.json';
import managePt from './pt-PT/manage.json';
import bookingPt from './pt-PT/booking.json';
import agendaPt from './pt-PT/agenda.json';
import noticesPt from './pt-PT/notices.json';
import decidePt from './pt-PT/decide.json';

export const resources = {
  en: { menu, home, dashboard, admin, links, auth, pages, forms, respond, settings, account, oauth, responses, templates, landing, notifications, manage, decide, booking, agenda, notices },
  'pt-PT': { menu: menuPt, home: homePt, dashboard: dashboardPt, admin: adminPt, links: linksPt, auth: authPt, pages: pagesPt, forms: formsPt, respond: respondPt, settings: settingsPt, account: accountPt, oauth: oauthPt, responses: responsesPt, templates: templatesPt, landing: landingPt, notifications: notificationsPt, manage: managePt, decide: decidePt, booking: bookingPt, agenda: agendaPt, notices: noticesPt },
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
