import { type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandMark, ThemeToggle } from '@internal/ui';
import { UserMenu } from '../modules/auth/user-menu';

export function Layout({ children }: PropsWithChildren) {
  const { t } = useTranslation('landing');
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <BrandMark />
          <nav className="flex items-center gap-2 sm:gap-4">
            <a
              href="/about"
              className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              {t('nav_about')}
            </a>
            <ThemeToggle />
            <UserMenu />
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-muted/40">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="max-w-md">
            <BrandMark />
            <p className="mt-3 text-sm text-muted-foreground">
              {t('footer_tagline')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <a
              href="/about"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('nav_about')}
            </a>
            <a
              href="/privacy"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('footer_privacy')}
            </a>
            <a
              href="/report"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('footer_report')}
            </a>
            <a
              href="https://github.com/alexcastrodev/shortner"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('footer_source')}
            </a>
            <a
              href="/app"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('footer_dashboard')}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
