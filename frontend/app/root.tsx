import './app.css';
import { ColorSchemeScript } from '@mantine/core';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteLoaderData } from 'react-router';
import type { Route } from './+types/root';
import i18n, { i18nFor, loadNamespaces, loadResources, type I18nData } from './i18n';
import { readCookie, resolveLocale } from './i18n/locales';
import { namespacesFor } from './i18n/namespaces';
import { Providers } from './layout/providers';
import { useNonce } from './utils/nonce';

export const links: Route.LinksFunction = () => [
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  { rel: 'icon', href: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
  { rel: 'icon', href: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
  { rel: 'manifest', href: '/site.webmanifest' },
  {
    rel: 'preload',
    href: '/fonts/inter-latin-wght-normal.woff2',
    as: 'font',
    type: 'font/woff2',
    crossOrigin: 'anonymous',
  },
];

export async function loader({ request, pattern }: Route.LoaderArgs): Promise<I18nData> {
  const locale = resolveLocale({
    cookie: readCookie(request.headers.get('cookie')),
    acceptLanguage: request.headers.get('accept-language'),
  });

  return { locale, resources: await loadResources(locale, namespacesFor(pattern)) };
}

export const shouldRevalidate = () => false;

export const clientMiddleware: Route.ClientMiddlewareFunction[] = [
  async ({ pattern, url }, next) => {
    if (i18n.isInitialized && !(await loadNamespaces(i18n.language, namespacesFor(pattern)))) {
      window.location.assign(url);
      await new Promise(() => {});
    }
    return next();
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const nonce = useNonce();
  const data = useRouteLoaderData<typeof loader>('root');
  const [instance] = useState(() => i18nFor(data));

  return (
    <html lang={instance.language} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />

        <meta
          name="keywords"
          content="encurtador de link grátis, free link shortener, url shortener, short url, link shortener free, encurtador de url, shorten link, kurz link shortener, bitly alternative, free url shortener, link encurtador, short links, custom short links"
        />
        <meta name="author" content="Kurz" />
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        <meta name="googlebot" content="index, follow" />
        <meta name="google" content="nositelinkssearchbox" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kurz" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:locale:alternate" content="pt_BR" />

        <meta name="application-name" content="Kurz" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Kurz" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#f7f8fa"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#101418"
        />

        <ColorSchemeScript defaultColorScheme="auto" nonce={nonce} />
        <Meta />
        <Links />
      </head>
      <body>
        <I18nextProvider i18n={instance}>
          <Providers>{children}</Providers>
        </I18nextProvider>
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export { ErrorBoundary } from '@internal/ui';
