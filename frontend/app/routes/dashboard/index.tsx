import type { Route } from './+types';
import { useGetShortlinks } from 'packages/core/actions/get-shortlinks/get-shortlinks.hook';
import { LinksList, TotalLinksCard } from './components';
import { QuickCreate } from '../../modules/quick-create';
import { PageContainer } from '@internal/ui';
import { useState } from 'react';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Dashboard' },
    { name: 'description', content: 'Create shareable links' },
  ];
}

export const ssr = false;

const PER_PAGE = 20;

export default function Page() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetShortlinks({ page, per_page: PER_PAGE });

  const total = data?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <div className="mb-6">
        <p className="text-sm font-medium text-muted-foreground">Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Links
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <LinksList links={data?.shortlink || []} isLoading={isLoading} />

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <TotalLinksCard total={total} isLoading={isLoading} />
          <QuickCreate />
        </div>
      </div>
    </PageContainer>
  );
}
