import type { Route } from './+types';
import { useGetShortlinks } from 'packages/core/actions/get-shortlinks/get-shortlinks.hook';
import { LinksList, TotalLinksCard } from './components';
import { QuickCreate } from '../../modules/quick-create';
import { Container } from '@mantine/core';

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
    <Container size="xl" my="lg">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <LinksList links={data?.shortlink || []} isLoading={isLoading} />

        <div className="space-y-4 lg:sticky lg:top-24">
          <TotalLinksCard total={data?.total || 0} isLoading={isLoading} />
          <QuickCreate />
        </div>
      </div>
    </Container>
  );
}
