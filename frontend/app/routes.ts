import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from '@react-router/dev/routes';

export default [
  index('routes/index.tsx'),
  layout('layout/index.tsx', [
    ...prefix('app', [
      index('routes/dashboard/index.tsx'),
      route('links', 'routes/links.tsx'),
      route('links/:id', 'routes/links/$id.tsx'),
    ]),
  ]),
  layout('layout/guest.tsx', [
    route('login', 'routes/login/index.tsx'),
    route('login-confirmation', 'routes/login/confirmation/index.tsx'),
  ]),
] satisfies RouteConfig;
