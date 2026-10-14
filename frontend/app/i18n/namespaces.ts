import type { CustomTypeOptions } from 'i18next';

export type Namespace = keyof CustomTypeOptions['resources'];

export const ROUTE_NAMESPACES: Record<string, Namespace[]> = {
  '/': ['auth', 'landing', 'menu', 'pages'],
  '/about': ['auth', 'landing'],
  '/privacy': ['auth', 'landing'],
  '/service': ['auth', 'landing'],
  '/report': ['auth', 'landing'],
  '/status/success': ['auth', 'landing'],
  '/u/:username': ['landing', 'pages'],
  '/s/:shortCode': ['unlock'],
  '/f/:publicId': ['forms', 'menu', 'respond'],
  '/m/:token': ['manage', 'menu'],
  '/a/:token': ['decide', 'menu'],
  '/v/:token': ['menu', 'verify'],
  '/w/:token': ['menu', 'waitlist'],
  '/oauth/authorize': ['account', 'appointments', 'forms', 'oauth', 'pages', 'responses'],
  '/app': ['dashboard', 'links', 'menu', 'notifications'],
  '/app/links/:id': ['links', 'menu', 'notifications'],
  '/app/pages': ['menu', 'notifications', 'pages'],
  '/app/pages/:id': ['landing', 'links', 'menu', 'notifications', 'pages', 'templates'],
  '/app/pages/:id/stats': ['landing', 'menu', 'notifications', 'pages', 'responses'],
  '/app/agenda': ['agenda', 'menu', 'notifications'],
  '/app/forms': ['forms', 'menu', 'notifications'],
  '/app/forms/:id': ['booking', 'cover', 'forms', 'landing', 'links', 'menu', 'notifications', 'pages', 'respond'],
  '/app/forms/:id/responses': ['appointments', 'forms', 'menu', 'notifications', 'responses'],
  '/app/account': ['account', 'appointments', 'auth', 'calendarFeed', 'forms', 'menu', 'notices', 'notifications', 'oauth', 'pages', 'responses', 'settings'],
  '/app/notifications': ['menu', 'notifications'],
  '/admin': ['menu', 'notifications'],
  '/admin/users': ['admin', 'menu', 'notifications'],
  '/admin/shortlinks': ['admin', 'menu', 'notifications'],
  '/admin/audit-logs': ['menu', 'notifications'],
  '/admin/moderation': ['landing', 'menu', 'notifications', 'pages', 'templates'],
  '/admin/moderation/abuse': ['menu', 'notifications'],
  '/login': ['auth', 'menu', 'settings'],
  '/login-confirmation': ['auth', 'settings'],
  '/signup': ['auth', 'settings'],
  '/password/forgot': ['auth', 'settings'],
  '/password/reset': ['auth', 'settings'],
};

export function namespacesFor(pattern: string): Namespace[] {
  return ROUTE_NAMESPACES[`/${pattern.replace(/^\/+/, '')}`] ?? [];
}
