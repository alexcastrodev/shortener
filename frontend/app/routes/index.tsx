import {
  IconLink,
  IconBolt,
  IconChartBar,
  IconArrowRight,
  IconSparkles,
} from '@tabler/icons-react';
import type { MetaFunction } from 'react-router';

export const meta: MetaFunction = () => {
  return [
    { title: 'Kurz' },
    { name: 'description', content: 'Free Forever Short URL Service' },
  ];
};

export default function LinkShortenerLanding() {
  return (
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
              Shorten links.
              <br />
              <span className="text-zinc-600">Amplify reach.</span>
            </h1>

            <p className="text-lg sm:text-xl text-zinc-400 mb-8 sm:mb-10 max-w-2xl mx-auto px-4">
              Transform long URLs into sleek, trackable short links.
            </p>

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
                title: 'Lightning Fast',
                desc: 'Generate links in milliseconds',
              },
              {
                icon: IconChartBar,
                title: 'Analytics',
                desc: 'Track clicks in real-time',
              },
              {
                icon: IconLink,
                title: 'Simple',
                desc: 'Passwordless authentication',
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12 text-center">
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
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800 bg-black/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-violet-600 rounded flex items-center justify-center">
                <IconLink size={16} stroke={2.5} />
              </div>
              <span className="font-semibold">Kurz</span>
            </div>
            <div className="text-sm text-zinc-500 text-center sm:text-right">
              © 2025 Kurz. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
