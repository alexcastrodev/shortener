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
  route('status/success', 'routes/status/success.tsx'),
  layout('layout/index.tsx', [
    ...prefix('app', [
      index('routes/dashboard/index.tsx'),
      route('links/:id', 'routes/links/$id.tsx'),
    ]),
    ...prefix('admin', [
      route('users', 'routes/admin/users.tsx'),
      route('shortlinks', 'routes/admin/shortlinks.tsx'),
    ]),
  ]),
  layout('layout/guest.tsx', [
    route('login', 'routes/login/index.tsx'),
    route('login-confirmation', 'routes/login/confirmation/index.tsx'),
  ]),
] satisfies RouteConfig;
