import { IconArrowRight, IconLink } from '@tabler/icons-react';
import type { MetaFunction } from 'react-router';
import { Layout } from '../layout/web-layout';

export const meta: MetaFunction = () => {
  const title = 'Kurz - Link Shortener';
  const description =
    'Create short links, keep them manageable, and review click data from a simple dashboard.';
  const url = 'https://kurz.fyi';
  const image = `${url}/logo-light.webp`;

  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { property: 'og:image', content: image },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: 'Kurz - Link Shortener' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
    { name: 'twitter:url', content: url },
    {
      name: 'keywords',
      content:
        'link shortener, url shortener, short url, shorten link, custom short links, link analytics, encurtador de url',
    },
    { tagName: 'link', rel: 'canonical', href: url },
  ];
};

export default function LinkShortenerLanding() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Kurz',
    alternateName: ['Link Shortener', 'URL Shortener'],
    url: 'https://kurz.fyi',
    description:
      'Create short links, keep them manageable, and review click data from a simple dashboard.',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    featureList: [
      'Link shortening',
      'Click analytics',
      'Passwordless authentication',
      'Open source',
    ],
    screenshot: 'https://kurz.fyi/logo-light.webp',
    author: {
      '@type': 'Organization',
      name: 'Kurz',
    },
    softwareVersion: '1.0',
  };

  return (
    <Layout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="mx-auto grid min-h-[calc(100vh-65px)] max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground">
            <IconLink size={16} stroke={1.8} />
            Link shortener
          </div>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            Kurz
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Turn long URLs into concise links you can share, manage, and review
            from one simple dashboard.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="/login"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get started
              <IconArrowRight size={18} />
            </a>
            <a
              href="/about"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-card px-6 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Learn more
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="space-y-3">
            <div className="h-10 rounded-md border border-border bg-muted" />
            <div className="rounded-md border border-border bg-background p-4">
              <div className="mb-3 h-3 w-20 rounded bg-muted" />
              <div className="h-4 w-4/5 rounded bg-muted" />
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-7 w-20 rounded-md bg-accent" />
              </div>
            </div>
            <div className="rounded-md border border-border bg-background p-4 opacity-70">
              <div className="mb-3 h-3 w-16 rounded bg-muted" />
              <div className="h-4 w-3/5 rounded bg-muted" />
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
