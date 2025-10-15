import { Layout } from '../../components/layout';
import type { Route } from './+types';
import { useGetShortlinks } from 'packages/core/actions/get-shortlinks/get-shortlinks.hook';
import { DashboardHeader, DashboardSidebar, LinksList } from './components';

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
    <Layout.Main>
      <div className="container mx-auto px-4 max-w-7xl">
        <DashboardHeader />

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <DashboardSidebar total={data?.total || 0} isLoading={isLoading} />

          <LinksList links={data?.shortlink || []} isLoading={isLoading} />
        </div>
      </div>
    </Layout.Main>
  );
}
