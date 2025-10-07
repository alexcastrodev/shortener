import {
  type RouteConfig,
  index,
  layout,
  route,
} from '@react-router/dev/routes';

export default [
  route('', 'layout/index.tsx', [
    index('routes/home/index.tsx'),
    route('links', 'routes/links.tsx'),
    route('links/:id', 'routes/links/$id.tsx'),
  ]),
  route('login', 'routes/login/index.tsx'),
  route('login-confirmation', 'routes/login/confirmation/index.tsx'),
] satisfies RouteConfig;
