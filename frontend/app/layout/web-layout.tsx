import { IconLink } from '@tabler/icons-react';
import { type PropsWithChildren } from 'react';
import { UserMenu } from '../modules/auth/user-menu';

export function Layout({ children }: PropsWithChildren) {
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
          <a href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-violet-600 rounded-lg flex items-center justify-center">
              <IconLink size={18} className="sm:hidden" stroke={2.5} />
              <IconLink size={20} className="hidden sm:block" stroke={2.5} />
            </div>
            <span className="text-lg sm:text-xl font-semibold">Kurz</span>
          </a>

          <div className="flex items-center gap-6">
            <UserMenu />
          </div>
        </div>
      </nav>

      {children}

      <footer className="relative z-10 border-t border-zinc-800 bg-black/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6 pb-6 border-b border-zinc-800">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-violet-600 rounded flex items-center justify-center">
                  <IconLink size={16} stroke={2.5} />
                </div>
                <span className="text-base font-semibold">Kurz</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Fast, secure, and free URL shortening service. Track your links
                with real-time analytics.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-3">
                Features
              </h3>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-base">📊</div>
                  <span className="text-xs text-zinc-400">
                    Real-Time Analytics
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-base">💜</div>
                  <span className="text-xs text-zinc-400">Free Forever</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-base">🔒</div>
                  <span className="text-xs text-zinc-400">Safety First</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Links</h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="/about"
                    className="text-xs text-zinc-400 hover:text-violet-400 transition-colors"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/alexcastrodev/shortner"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-zinc-400 hover:text-violet-400 transition-colors"
                  >
                    Open Source
                  </a>
                </li>
                <li>
                  <a
                    href="/app"
                    className="text-xs text-zinc-400 hover:text-violet-400 transition-colors"
                  >
                    Create Account
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="text-center">
            <div className="text-xs text-zinc-500">
              © 2025 Kurz. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
