import { IconLogout } from '@tabler/icons-react';
import { useAuth } from './use-auth';

export function UserMenu() {
  const { user, handleLogout } = useAuth();

  if (!user) {
    return (
      <a
        href="/app"
        className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:px-4"
      >
        Sign in
      </a>
    );
  }

  return (
    <>
      <a
        href="/"
        className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
      >
        Home
      </a>
      <a
        href="/app"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Dashboard
      </a>
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/15 sm:px-4"
      >
        <IconLogout size={16} />
        <span className="hidden sm:inline">Logout</span>
      </button>
    </>
  );
}
