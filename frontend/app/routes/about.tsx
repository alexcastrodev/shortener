import type { MetaFunction } from 'react-router';
import { Layout } from '../layout/web-layout';

export const meta: MetaFunction = () => {
  return [
    { title: 'About - Kurz | Free Link Shortener' },
    {
      name: 'description',
      content:
        'Learn more about Kurz - a completely free, open-source URL shortener with real-time analytics. No hidden costs, no premium tiers.',
    },
  ];
};

export default function About() {
  return (
    <Layout>
      <div className="relative z-10 flex-1 px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6">
              About <span className="text-violet-400">Kurz</span>
            </h1>
            <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto">
              A free, open-source link shortener built with simplicity and
              transparency in mind
            </p>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 sm:p-8 backdrop-blur-sm mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-center">
              Why Choose Our Free Link Shortener?
            </h2>
            <div className="space-y-6 text-zinc-300 leading-relaxed">
              <p className="text-base sm:text-lg">
                <strong className="text-white">Kurz</strong> is a completely
                free URL shortener service that helps you create short links
                instantly. Whether you need to share links on social media,
                track marketing campaigns, or simply make your URLs more
                manageable, our <strong>free link shortener</strong> has you
                covered.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
                <div className="flex items-start gap-4">
                  <div className="text-violet-400 text-xl mt-1">✓</div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">
                      Free Forever
                    </h3>
                    <p className="text-sm text-zinc-400">
                      No hidden costs or premium tiers. Kurz is completely free
                      to use, forever. We believe link shortening should be
                      accessible to everyone.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="text-violet-400 text-xl mt-1">✓</div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">
                      Analytics Included
                    </h3>
                    <p className="text-sm text-zinc-400">
                      Track every click in real-time. Get detailed insights
                      about your audience including location, device type, and
                      browser information.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="text-violet-400 text-xl mt-1">✓</div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">
                      Open Source
                    </h3>
                    <p className="text-sm text-zinc-400">
                      Transparent and community-driven. Our code is publicly
                      available on GitHub. You can review, contribute, or even
                      self-host your own instance.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="text-violet-400 text-xl mt-1">✓</div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">
                      Safe & Secure
                    </h3>
                    <p className="text-sm text-zinc-400">
                      All links are automatically checked using Google Safe
                      Browsing to protect you and your audience from malicious
                      content.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="text-violet-400 text-xl mt-1">✓</div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">
                      No Registration Required
                    </h3>
                    <p className="text-sm text-zinc-400">
                      Create short links instantly without signing up. For
                      advanced features and link management, you can optionally
                      create a free account.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="text-violet-400 text-xl mt-1">✓</div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">
                      Easy to Use
                    </h3>
                    <p className="text-sm text-zinc-400">
                      Simple, intuitive interface designed for everyone. Paste
                      your URL, click shorten, and you're done. No complicated
                      settings or confusing options.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 sm:p-8 backdrop-blur-sm mb-8">
            <h2 className="text-xl sm:text-2xl font-bold mb-4">
              Perfect for Everyone
            </h2>
            <div className="space-y-4 text-zinc-300">
              <p className="text-sm sm:text-base">
                Whether you're a{' '}
                <strong className="text-white">marketer</strong> tracking
                campaign performance, a{' '}
                <strong className="text-white">content creator</strong> sharing
                links with your audience, or just someone who wants to{' '}
                <strong className="text-white">share cleaner links</strong>,
                Kurz is designed for you.
              </p>
              <p className="text-sm sm:text-base">
                Our service is lightweight, fast, and built with modern
                technology to ensure the best possible experience for both you
                and the people clicking your links.
              </p>
            </div>
          </div>

          <div className="text-center">
            <a
              href="/"
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 bg-violet-600 hover:bg-violet-500 rounded-lg font-semibold transition-all"
            >
              Get Started Free
            </a>
            <p className="text-sm text-zinc-500 mt-4">
              No credit card required • No time limit • No hidden fees
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
