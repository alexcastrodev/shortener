import type { Route } from './+types';
import { useGetShortlinks } from 'packages/core/actions/get-shortlinks/get-shortlinks.hook';
import { LinksList, TotalLinksCard } from './components';
import { QuickCreate } from '../../modules/quick-create';
import { PageContainer } from '@internal/ui';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Dashboard' },
    { name: 'description', content: 'Create shareable links' },
  ];
}

export const ssr = false;

export default function Page() {
  const { data, isLoading } = useGetShortlinks();

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <div className="mb-6">
        <p className="text-sm font-medium text-muted-foreground">Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Links
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <LinksList links={data?.shortlink || []} isLoading={isLoading} />

        <div className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <TotalLinksCard total={data?.total || 0} isLoading={isLoading} />
          <QuickCreate />
        </div>
      </div>
    </PageContainer>
  );
}
