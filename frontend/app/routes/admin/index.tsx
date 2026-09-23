import { Link } from 'react-router';
import {
  IconChevronRight,
  IconHistory,
  IconLink,
  IconLock,
  IconSettings,
  IconShieldCheck,
  IconUsers,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Alert, PageContainer } from '@internal/ui';
import { useGetLoggedUser } from '@internal/core/actions/get-logged-user/get-logged-user.hook';
import { useAdminAbuseSignals } from '@internal/core/actions/admin-abuse-signals/admin-abuse-signals.hook';
import { useAdminPageTemplates } from '@internal/core/actions/admin-page-templates/admin-page-templates.hook';

export const ssr = false;

export function meta() {
  return [{ title: 'Administration - Kurz' }];
}

// The admin hub: one entry in the bottom bar leads here, and from here to
// every admin section (like a phone's Settings screen).
export default function AdminIndexPage() {
  const { data } = useGetLoggedUser();
  const { t } = useTranslation('menu');
  const isAdmin = !!data?.user?.admin;
  const { data: signals } = useAdminAbuseSignals('open', { enabled: isAdmin });
  const { data: reported } = useAdminPageTemplates('reported', {
    enabled: isAdmin,
  });
  const pending =
    (signals?.abuse_signal.length ?? 0) + (reported?.page_template.length ?? 0);

  if (data && !isAdmin) {
    return (
      <PageContainer>
        <Alert
          variant="error"
          icon={<IconLock size={24} />}
          title="Access denied"
        >
          Only administrators can see this page.
        </Alert>
      </PageContainer>
    );
  }

  const sections = [
    {
      to: '/admin/users',
      icon: IconUsers,
      title: t('users'),
      description: 'Accounts, activate and deactivate',
    },
    {
      to: '/admin/shortlinks',
      icon: IconLink,
      title: t('shortlinks'),
      description: 'Every link, safety and status',
    },
    {
      to: '/admin/audit-logs',
      icon: IconHistory,
      title: t('audit_logs'),
      description: 'Who changed what, and when',
    },
    {
      to: '/admin/moderation',
      icon: IconShieldCheck,
      title: t('moderation'),
      description: 'Reported templates, abuse signals',
      count: pending,
    },
  ];

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="inline-flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <IconSettings size={21} stroke={1.8} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('administration')}
        </h1>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {sections.map(({ to, icon: Icon, title, description, count }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent/60 active:bg-accent"
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon size={19} stroke={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {description}
                </span>
              </span>
              {!!count && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                  {count}
                </span>
              )}
              <IconChevronRight
                size={18}
                className="shrink-0 text-muted-foreground"
              />
            </Link>
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
