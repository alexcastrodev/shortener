import {
  IconArrowRight,
  IconChartBar,
  IconClick,
  IconCode,
  IconLink,
  IconShieldCheck,
} from '@tabler/icons-react';
import type { MetaFunction } from 'react-router';
import { Card } from '@internal/ui';
import { Layout } from '../layout/web-layout';

const features = [
  {
    icon: IconChartBar,
    title: 'Analytics included',
    description:
      'Review click data for your links, including location, device, and browser.',
  },
  {
    icon: IconShieldCheck,
    title: 'Safety checks',
    description:
      'Links are checked with Google Safe Browsing before they are kept active.',
  },
  {
    icon: IconCode,
    title: 'Open source',
    description:
      'Transparent and available on GitHub for review, contribution, or self-hosting.',
  },
];

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
            Shorten links. Track every click.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Kurz turns long URLs into short, shareable links and shows you who
            clicked, from where, and on what device.
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
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
              <IconLink size={16} className="shrink-0" />
              <span className="truncate">
                https://example.com/campaigns/summer-launch/2026
              </span>
            </div>

            <div className="rounded-md border border-border bg-background p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Your short link
              </p>
              <p className="mt-1 truncate text-base font-semibold text-foreground">
                kurz.fyi/x7f2A
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <IconClick size={14} />
                  128 clicks
                </span>
                <span className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                  Active
                </span>
              </div>
            </div>

            <div className="rounded-md border border-border bg-background p-4 opacity-60">
              <p className="text-xs font-medium text-muted-foreground">
                Your short link
              </p>
              <p className="mt-1 truncate text-base font-semibold text-foreground">
                kurz.fyi/9kLpr
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="p-5">
              <div className="mb-4 inline-flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Icon size={20} stroke={1.8} />
              </div>
              <h2 className="text-base font-semibold text-foreground">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </Layout>
  );
}
