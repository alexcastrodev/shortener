import { IconChevronLeft } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { KurzLogo, ThemeToggle } from '@internal/ui';

// The frame of every sign-in screen: a narrow centered column with the mark,
// a title and a line under it, over the landing page's grid and glow.
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="landing-grid pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden="true"
        className="landing-glow pointer-events-none absolute inset-0"
      />

      <div className="relative flex items-center justify-between px-5 py-5 sm:px-8">
        <a
          href="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <IconChevronLeft size={16} />
          Home
        </a>
        <ThemeToggle />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-84px)] w-full max-w-[380px] flex-col justify-center px-4 pb-20">
        <KurzLogo className="mx-auto size-12" />
        <h1 className="mt-6 text-center text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-center text-[15px] text-muted-foreground">
            {subtitle}
          </p>
        )}
        <div className="mt-8">{children}</div>
        {footer && (
          <div className="mt-8 text-center text-xs text-muted-foreground">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}

// "or" between two ways of doing the same thing.
export function AuthDivider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
