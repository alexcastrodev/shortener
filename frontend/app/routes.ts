import {
  type RouteConfig,
  index,
  layout,
  route,
} from '@react-router/dev/routes';

export default [
  index('routes/index.tsx'),
  route('app', 'layout/index.tsx', [
    index('routes/dashboard/index.tsx'),
    route('links', 'routes/links.tsx'),
    route('links/:id', 'routes/links/$id.tsx'),
  ]),
  route('login', 'routes/login/index.tsx'),
  route('login-confirmation', 'routes/login/confirmation/index.tsx'),
] satisfies RouteConfig;
