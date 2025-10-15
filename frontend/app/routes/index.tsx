import {
  IconLink,
  IconBolt,
  IconChartBar,
  IconArrowRight,
  IconSparkles,
} from '@tabler/icons-react';
import type { MetaFunction } from 'react-router';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCreatePublicShortlink } from '@internal/core/actions/create-public-shortlink/create-public-shortlink.hook';
import type { Shortlink } from '@internal/core/types/Shortlink';

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

  const { mutate: createShortlink, isPending } = useCreatePublicShortlink({
    onSuccess: (data: Shortlink) => {
      navigate('/status/success', { state: { shortlink: data } });
    },
    onError: () => {
      alert('Failed to create short link. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    createShortlink({ original_url: url.trim() });
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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white overflow-hidden flex flex-col">
        <div className="fixed inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(124,58,237,0.3) 1px, transparent 0)`,
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        <div className="fixed inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/50 pointer-events-none" />

        <nav className="relative z-50 px-4 sm:px-6 py-4 sm:py-5 border-b border-zinc-800 bg-black/50 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-violet-600 rounded-lg flex items-center justify-center">
                <IconLink size={18} className="sm:hidden" stroke={2.5} />
                <IconLink size={20} className="hidden sm:block" stroke={2.5} />
              </div>
              <span className="text-lg sm:text-xl font-semibold">Kurz</span>
            </div>

            <a
              href="/app"
              className="text-sm px-4 sm:px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-all border border-zinc-800 hover:border-zinc-700"
            >
              Sign in
            </a>
          </div>
        </nav>

        <div className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
          <div className="max-w-5xl w-full">
            <div className="text-center mb-12 sm:mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 mb-4 sm:mb-6">
                <IconSparkles size={16} className="text-violet-400" />
                <span className="text-sm text-violet-300">Free forever</span>
              </div>

              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 leading-tight">
                Shorten links
                <br />
                <span className="text-zinc-600">Free Link Shortener</span>
              </h1>

              <p className="text-lg sm:text-xl text-zinc-400 mb-8 sm:mb-10 max-w-2xl mx-auto px-4">
                Transform long URLs into sleek, trackable short links. Create
                custom short URLs with real-time analytics, completely free
                forever.
              </p>

              {/* Shortlink Creation Form */}
              <div className="mb-8 sm:mb-10 max-w-2xl mx-auto px-4">
                <form onSubmit={handleSubmit} className="relative">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="url"
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Paste your long URL here..."
                      className="flex-1 px-4 sm:px-6 py-3 sm:py-4 rounded-lg bg-zinc-900/50 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all"
                      disabled={isPending}
                      required
                    />
                    <button
                      type="submit"
                      disabled={isPending || !url.trim()}
                      className="px-6 sm:px-8 py-3 sm:py-4 bg-violet-600 hover:bg-violet-500 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-105 transform disabled:hover:scale-100"
                    >
                      {isPending ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Shortening...
                        </>
                      ) : (
                        <>
                          Short Link
                          <IconArrowRight size={20} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              <div className="mb-6 sm:mb-8 max-w-2xl mx-auto px-4">
                <p className="text-sm text-zinc-500 italic">
                  💡 Want to track links and view analytics? Please{' '}
                  <a
                    href="/app"
                    className="text-violet-400 hover:text-violet-300 underline"
                  >
                    sign in
                  </a>{' '}
                  to access advanced features.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                <a
                  href="/app"
                  className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-violet-600 hover:bg-violet-500 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 hover:scale-105 transform"
                >
                  Get Started Free
                  <IconArrowRight size={20} />
                </a>
                <a
                  href="https://github.com/alexcastrodev/shortner"
                  target="_blank"
                  className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-zinc-900 hover:bg-zinc-800 rounded-lg font-semibold transition-all border border-zinc-800 hover:border-zinc-700"
                >
                  Open Source Code
                </a>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-sm text-zinc-500">
                <div>🎉 Built for fun</div>
                <div>🌍 Available globally</div>
                <div>🔒 100% Open Source</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-12 sm:mb-16">
              {[
                {
                  icon: IconBolt,
                  title: 'Lightning Fast URL Shortener',
                  desc: 'Create short links in milliseconds with our free link shortener',
                },
                {
                  icon: IconChartBar,
                  title: 'Real-Time Analytics',
                  desc: 'Track clicks and monitor your shortened URLs performance',
                },
                {
                  icon: IconLink,
                  title: 'Free Forever',
                  desc: 'No credit card required. 100% free link shortening service',
                },
              ].map((feature, idx) => (
                <div
                  key={idx}
                  className="p-4 sm:p-6 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all backdrop-blur-sm group hover:bg-zinc-900/70"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-violet-600/10 flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-violet-600/20 transition-colors">
                    <feature.icon
                      size={20}
                      className="sm:hidden text-violet-400"
                      stroke={2}
                    />
                    <feature.icon
                      size={24}
                      className="hidden sm:block text-violet-400"
                      stroke={2}
                    />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12 text-center mb-16">
              {[
                { metric: '💜', label: 'Made with love' },
                { metric: '🚀', label: 'Built for learning' },
                { metric: '✨', label: 'Always improving' },
              ].map((stat, idx) => (
                <div key={idx}>
                  <div className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2">
                    {stat.metric}
                  </div>
                  <div className="text-zinc-400 text-sm sm:text-base">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* SEO Content Section */}
            <div className="max-w-4xl mx-auto mt-16 p-8 rounded-xl bg-zinc-900/30 border border-zinc-800 backdrop-blur-sm">
              <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-center">
                Why Choose Our Free Link Shortener?
              </h2>
              <div className="space-y-4 text-zinc-300 leading-relaxed">
                <p>
                  <strong className="text-white">Kurz</strong> is a completely
                  free URL shortener service that helps you create short links
                  instantly. Whether you need to share links on social media,
                  track marketing campaigns, or simply make your URLs more
                  manageable, our <strong>free link shortener</strong> has you
                  covered.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div className="flex items-start gap-3">
                    <div className="text-violet-400 mt-1">✓</div>
                    <div>
                      <strong className="text-white">Free Forever:</strong> No
                      hidden costs or premium tiers
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-violet-400 mt-1">✓</div>
                    <div>
                      <strong className="text-white">
                        Analytics Included:
                      </strong>{' '}
                      Track every click in real-time
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-violet-400 mt-1">✓</div>
                    <div>
                      <strong className="text-white">Open Source:</strong>{' '}
                      Transparent and community-driven
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="relative z-10 border-t border-zinc-800 bg-black/50 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-violet-600 rounded flex items-center justify-center">
                  <IconLink size={16} stroke={2.5} />
                </div>
                <span className="font-semibold">
                  Kurz - Free Link Shortener
                </span>
              </div>

              <nav className="flex gap-6 text-sm">
                <a
                  href="https://github.com/alexcastrodev/shortner"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  GitHub
                </a>
                <a
                  href="/app"
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  Get Started
                </a>
              </nav>

              <div className="text-sm text-zinc-500 text-center sm:text-right">
                © 2025 Kurz. All rights reserved.
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-zinc-800 text-center text-sm text-zinc-500">
              <p className="mb-2">
                <strong className="text-zinc-400">Keywords:</strong> Free Link
                Shortener, Encurtador de Link Grátis, URL Shortener, Short URL,
                Bitly Alternative
              </p>
              <p>
                Open source link shortening service with real-time analytics.
                Create short links for free, forever.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
