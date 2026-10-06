import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from '@react-router/dev/routes';

export default [
  index('routes/index.tsx'),
  route('about', 'routes/about.tsx'),
  route('privacy', 'routes/privacy.tsx'),
  route('report', 'routes/report.tsx'),
  route('status/success', 'routes/status/success.tsx'),
  layout('layout/bio-layout.tsx', [
    route('u/:username', 'routes/bio/$username.tsx'),
    route('s/:shortCode', 'routes/unlock/$shortCode.tsx'),
    route('f/:publicId', 'routes/f/$publicId.tsx'),
    route('m/:token', 'routes/m/$token.tsx'),
    route('a/:token', 'routes/a/$token.tsx'),
    route('v/:token', 'routes/v/$token.tsx'),
    route('w/:token', 'routes/w/$token.tsx'),
    route('oauth/authorize', 'routes/oauth/authorize.tsx'),
  ]),
  layout('layout/index.tsx', [
    ...prefix('app', [
      index('routes/dashboard/index.tsx'),
      route('links/:id', 'routes/links/$id.tsx'),
      route('pages', 'routes/pages/index.tsx'),
      route('pages/:id', 'routes/pages/$id.tsx'),
      route('pages/:id/stats', 'routes/pages/stats.tsx'),
      route('agenda', 'routes/agenda/index.tsx'),
      route('forms', 'routes/forms/index.tsx'),
      route('forms/:id', 'routes/forms/$id.tsx'),
      route('forms/:id/responses', 'routes/forms/responses.tsx'),
      route('account', 'routes/account.tsx'),
    ]),
    ...prefix('admin', [
      index('routes/admin/index.tsx'),
      route('users', 'routes/admin/users.tsx'),
      route('shortlinks', 'routes/admin/shortlinks.tsx'),
      route('audit-logs', 'routes/admin/audit-logs.tsx'),
      route('moderation', 'routes/admin/moderation/templates.tsx'),
      route('moderation/abuse', 'routes/admin/moderation/abuse.tsx'),
    ]),
  ]),
  layout('layout/guest.tsx', [
    route('login', 'routes/login/index.tsx'),
    route('login-confirmation', 'routes/login/confirmation/index.tsx'),
    route('signup', 'routes/signup.tsx'),
    route('password/forgot', 'routes/password/forgot.tsx'),
    route('password/reset', 'routes/password/reset.tsx'),
  ]),
] satisfies RouteConfig;
