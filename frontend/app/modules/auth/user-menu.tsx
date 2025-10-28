import { IconLogout } from '@tabler/icons-react';
import { useAuth } from './use-auth';

export function UserMenu() {
  const { user, handleLogout } = useAuth();

  if (!user) {
    return (
      <a
        href="/app"
        className="text-sm px-4 sm:px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-all border border-zinc-800 hover:border-zinc-700"
      >
        Sign in
      </a>
    );
  }

  return (
    <>
      <a
        href="/"
        className="text-sm text-zinc-400 hover:text-white transition-colors"
      >
        Home
      </a>
      <a
        href="/dashboard"
        className="text-sm text-zinc-400 hover:text-white transition-colors"
      >
        Dashboard
      </a>
      <button
        onClick={handleLogout}
        className="text-sm px-4 sm:px-5 py-2 rounded-lg bg-red-900/20 hover:bg-red-900/30 transition-all border border-red-800/50 hover:border-red-700 flex items-center gap-2 text-red-400 hover:text-red-300"
      >
        <IconLogout size={16} />
        <span className="hidden sm:inline">Logout</span>
      </button>
    </>
  );
}
