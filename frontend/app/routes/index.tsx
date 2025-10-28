import { IconArrowRight } from '@tabler/icons-react';
import type { MetaFunction } from 'react-router';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCreatePublicShortlink } from '@internal/core/actions/create-public-shortlink/create-public-shortlink.hook';
import type { Shortlink } from '@internal/core/types/Shortlink';
import { Layout } from '../layout/web-layout';
import { EmailField } from '../modules/shortlink-form/email-field';

export const meta: MetaFunction = () => {
  const title = 'Kurz - Free Link Shortener | Encurtador de Link Grátis';
  const description =
    'Free forever link shortener with analytics. Shorten URLs instantly and track clicks in real-time. Encurtador de link grátis com analytics. Open source and 100% free.';
  const url = 'https://kurz.fyi';
  const image = `${url}/logo-dark.webp`;

  return [
    { title },
    { name: 'description', content: description },

    // Open Graph
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { property: 'og:image', content: image },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: 'Kurz - Free Link Shortener' },

    // Twitter
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
    { name: 'twitter:url', content: url },

    // Additional SEO
    {
      name: 'keywords',
      content:
        'free link shortener, encurtador de link grátis, url shortener free, short url, shorten link, custom short links, link analytics, bitly alternative, free url shortener online, encurtador de url gratis, link encurtador',
    },
    { tagName: 'link', rel: 'canonical', href: url },
  ];
};

export default function LinkShortenerLanding() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');

  const { mutate: createShortlink, isPending } = useCreatePublicShortlink({
    onSuccess: (data: Shortlink) => {
      navigate('/status/success', {
        state: { shortlink: data, email: email || undefined },
      });
    },
    onError: response => {
      alert(response.error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    createShortlink({
      original_url: url.trim(),
      email: email.trim() || undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isPending) {
      handleSubmit(e as any);
    }
  };

  // Structured Data for SEO
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Kurz',
    alternateName: ['Free Link Shortener', 'Encurtador de Link Grátis'],
    url: 'https://kurz.fyi',
    description:
      'Free forever link shortener with real-time analytics. Transform long URLs into short, trackable links. Encurtador de link grátis com analytics em tempo real.',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'Lightning fast link shortening',
      'Real-time analytics and click tracking',
      'Custom short links',
      'Passwordless authentication',
      '100% free forever',
      'Open source',
    ],
    screenshot: 'https://kurz.fyi/logo-dark.webp',
    author: {
      '@type': 'Organization',
      name: 'Kurz',
    },
    softwareVersion: '1.0',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5',
      ratingCount: '1',
    },
  };

  return (
    <Layout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-3xl w-full">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
              Shorten Your Links
              <br />
              <span className="text-violet-400">Quick & Free</span>
            </h1>

            <p className="text-base sm:text-lg text-zinc-400 mb-10 sm:mb-12 max-w-xl mx-auto">
              Transform long URLs into short, easy-to-share links in seconds
            </p>

            {/* Shortlink Creation Form */}
            <div className="max-w-2xl mx-auto">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Paste your long URL here..."
                    className="flex-1 px-5 py-4 rounded-lg bg-zinc-900/50 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all text-base"
                    disabled={isPending}
                    required
                  />
                  <button
                    type="submit"
                    disabled={isPending || !url.trim()}
                    className="px-8 py-4 bg-violet-600 hover:bg-violet-500 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {isPending ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Creating...
                      </>
                    ) : (
                      <>
                        Shorten Link
                        <IconArrowRight size={20} />
                      </>
                    )}
                  </button>
                </div>

                <EmailField
                  email={email}
                  onChange={setEmail}
                  disabled={isPending}
                />
              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
