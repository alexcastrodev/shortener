import { NavLink } from 'react-router';
import { IconShieldCheck } from '@tabler/icons-react';
import { Breadcrumb } from '../../../components/breadcrumb';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  ].join(' ');

export function ModerationHeader({ section }: { section: string }) {
  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Administration', href: '/admin' },
          { label: 'Moderation' },
          { label: section },
        ]}
      />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <IconShieldCheck size={21} stroke={1.8} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Moderation
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{section}</h1>
          </div>
        </div>
        <nav className="flex gap-1">
          <NavLink to="/admin/moderation" end className={tabClass}>
            Templates
          </NavLink>
          <NavLink to="/admin/moderation/abuse" className={tabClass}>
            Abuse signals
          </NavLink>
        </nav>
      </div>
    </>
  );
}
