import 'i18next';
import type account from './en/account.json';
import type admin from './en/admin.json';
import type agenda from './en/agenda.json';
import type appointments from './en/appointments.json';
import type auth from './en/auth.json';
import type booking from './en/booking.json';
import type calendarFeed from './en/calendarFeed.json';
import type cover from './en/cover.json';
import type dashboard from './en/dashboard.json';
import type decide from './en/decide.json';
import type forms from './en/forms.json';
import type home from './en/home.json';
import type landing from './en/landing.json';
import type links from './en/links.json';
import type manage from './en/manage.json';
import type menu from './en/menu.json';
import type notices from './en/notices.json';
import type notifications from './en/notifications.json';
import type oauth from './en/oauth.json';
import type pages from './en/pages.json';
import type respond from './en/respond.json';
import type responses from './en/responses.json';
import type settings from './en/settings.json';
import type templates from './en/templates.json';
import type unlock from './en/unlock.json';
import type verify from './en/verify.json';
import type waitlist from './en/waitlist.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'menu';
    resources: {
      account: typeof account;
      admin: typeof admin;
      agenda: typeof agenda;
      appointments: typeof appointments;
      auth: typeof auth;
      booking: typeof booking;
      calendarFeed: typeof calendarFeed;
      cover: typeof cover;
      dashboard: typeof dashboard;
      decide: typeof decide;
      forms: typeof forms;
      home: typeof home;
      landing: typeof landing;
      links: typeof links;
      manage: typeof manage;
      menu: typeof menu;
      notices: typeof notices;
      notifications: typeof notifications;
      oauth: typeof oauth;
      pages: typeof pages;
      respond: typeof respond;
      responses: typeof responses;
      settings: typeof settings;
      templates: typeof templates;
      unlock: typeof unlock;
      verify: typeof verify;
      waitlist: typeof waitlist;
    };
  }
}
