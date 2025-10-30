import type { Route } from './+types';
import { useGetShortlinks } from 'packages/core/actions/get-shortlinks/get-shortlinks.hook';
import { LinksList, TotalLinksCard } from './components';
import { QuickCreate } from '../../modules/quick-create';

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
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white relative overflow-hidden">
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

      <div className="relative z-10 max-w-7xl mx-auto sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <LinksList links={data?.shortlink || []} isLoading={isLoading} />

          <div className="space-y-4 lg:sticky lg:top-24 h-fit">
            <TotalLinksCard total={data?.total || 0} isLoading={isLoading} />
            <QuickCreate />
          </div>
        </div>
      </div>
    </div>
  );
}
