import {
  IconArrowRight,
  IconCheck,
  IconClick,
  IconLink,
} from '@tabler/icons-react';
import type { LinksFunction, MetaFunction } from 'react-router';
import { Layout } from '../layout/web-layout';
import { BioShowcase } from '../modules/bio-page';
import { ClickGlobe, FeatureBento, HeroConsole } from '../modules/landing';
import { OG_IMAGE, SITE_URL, ogImageMeta } from '../modules/seo';

// Geist (display and mono) is only used on the landing page.
export const links: LinksFunction = () => [
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&display=swap',
  },
];

export const meta: MetaFunction = () => {
  const title = 'Kurz · Short links and bio pages';
  const description =
    'Shorten links, track every click and put all your links on one bio page. Free and open source.';
  const url = SITE_URL;

  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:url', content: url },
    ...ogImageMeta(),
    {
      name: 'keywords',
      content:
        'link shortener, url shortener, short url, shorten link, custom short links, link analytics, encurtador de url, bio link, link in bio, free url shortener',
    },
    { tagName: 'link', rel: 'canonical', href: url },
  ];
};

export default function LinkShortenerLanding() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Kurz',
    alternateName: ['Kurz link shortener', 'Kurz bio pages'],
    url: 'https://kurz.fyi',
    description:
      'Shorten links and build a bio link page. Free and open source.',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    featureList: [
      'Link shortening',
      'Click analytics',
      'Bio link pages',
      'QR codes',
      'Password-protected links',
      'Scheduled link expiration',
      'Passwordless authentication',
      'Free, no paid tiers',
      'Open source',
    ],
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    screenshot: OG_IMAGE.url,
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
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="landing-grid pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="landing-glow pointer-events-none absolute inset-0" />

        <div className="relative mx-auto max-w-7xl px-4 pt-16 sm:px-6 sm:pt-24 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="landing-rise mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur">
              <IconLink size={15} stroke={1.8} className="text-primary" />
              Link shortener · Free &amp; open source
            </div>
            <h1 className="landing-gradient-text landing-rise font-display text-5xl leading-[1.05] font-semibold tracking-tighter sm:text-6xl lg:text-7xl">
              Shorten links. Track every click.
            </h1>
            <p className="landing-rise mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Kurz turns long URLs into short, shareable links and shows you who
              clicked, from where, and on what device.
            </p>

            <div className="landing-rise mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href="/signup"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                Get started
                <IconArrowRight size={18} />
              </a>
              <a
                href="/about"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-card/60 px-6 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Learn more
              </a>
            </div>
          </div>

          <div className="relative mx-auto mt-12 max-w-5xl sm:mt-16">
            <ClickGlobe className="mx-auto -my-16 aspect-square w-full max-w-[880px] sm:-my-24" />

            <div className="pointer-events-none absolute inset-x-0 top-[18%] hidden justify-between px-2 lg:flex">
              <div className="landing-float rounded-xl border border-border bg-card/90 px-3 py-2 text-sm shadow-xl backdrop-blur-md">
                <span className="mr-2 inline-block size-2 rounded-full bg-primary" />
                Click from São Paulo · iOS
              </div>
              <div className="landing-float-delayed rounded-xl border border-border bg-card/90 px-3 py-2 text-sm shadow-xl backdrop-blur-md">
                <span className="mr-2 inline-block size-2 rounded-full bg-primary" />
                Click from Tokyo · Chrome
              </div>
            </div>

            <div className="relative z-10 mx-auto -mt-32 max-w-2xl pb-16 sm:-mt-56 sm:pb-24">
              <HeroConsole />
            </div>
          </div>
        </div>
      </section>

      {/* Bio pages */}
      <section id="bio-pages" className="relative overflow-hidden border-y border-border">
        <div aria-hidden="true" className="landing-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:px-8 lg:py-28">
          <div className="order-2 lg:order-1">
            <BioShowcase />
          </div>

          <div className="order-1 max-w-xl lg:order-2">
            <span className="mb-5 inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              New
            </span>
            <h2 className="font-display text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
              One link for all your links.
            </h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
              Add your links, pick a theme, share one page. Free, like
              everything else here.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {['Six ready-made themes', 'Your photo on top', 'QR code to print', 'Clicks for every link'].map(item => (
                <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <IconCheck size={13} stroke={2.5} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <a
              href="/app/pages"
              className="mt-10 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              Create your page
              <IconArrowRight size={18} />
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mb-10 max-w-2xl">
          <p className="font-mono text-xs font-medium tracking-widest text-primary uppercase">
            Every link
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            More than a short URL.
          </h2>
        </div>
        <FeatureBento />
      </section>

      {/* Trust band */}
      <section className="relative overflow-hidden border-t border-border">
        <div aria-hidden="true" className="landing-grid pointer-events-none absolute inset-0 opacity-70" />
        <div aria-hidden="true" className="landing-glow pointer-events-none absolute inset-0 rotate-180" />
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <p className="landing-gradient-text font-display text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            No paid plans. No credit card. Open source.
          </p>
          <a
            href="/signup"
            className="mt-10 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            <IconClick size={18} />
            Shorten your first link
          </a>
        </div>
      </section>
    </Layout>
  );
}
