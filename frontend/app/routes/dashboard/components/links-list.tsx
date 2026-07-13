import { useState, useMemo } from 'react';
import { Loader, TextInput } from '@mantine/core';
import { IconLink, IconSearch, IconX } from '@tabler/icons-react';
import { ShortlinkCard } from '~/components/shortlink-card';
import type { Shortlink } from 'packages/core/types/Shortlink';
import { useTranslation } from 'react-i18next';

interface LinksListProps {
  links: Shortlink[];
  isLoading: boolean;
}

export function LinksList({ links, isLoading }: LinksListProps) {
  const { t } = useTranslation('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLinks = useMemo(() => {
    if (!searchQuery.trim()) return links;

    const query = searchQuery.toLowerCase();
    return links.filter(link => {
      const title = link.title?.toLowerCase() || '';
      const shortCode = link.short_code?.toLowerCase() || '';
      const originalUrl = link.original_url?.toLowerCase() || '';

      return (
        title.includes(query) ||
        shortCode.includes(query) ||
        originalUrl.includes(query)
      );
    });
  }, [links, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader size="lg" color="brand" />
        <p className="mt-4 text-sm text-muted-foreground">
          {t('loading_links')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {links.length > 0 && (
        <div>
          <TextInput
            placeholder={
              t('search_links_placeholder') ||
              'Search by title, link or code...'
            }
            value={searchQuery}
            onChange={e => setSearchQuery(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            rightSection={
              searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="flex items-center text-muted-foreground hover:text-foreground"
                >
                  <IconX size={16} />
                </button>
              ) : null
            }
          />
          {searchQuery && (
            <p className="mt-2 text-sm text-muted-foreground">
              {filteredLinks.length} of {links.length} links
            </p>
          )}
        </div>
      )}

      {links.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <div className="mb-4 rounded-lg bg-accent p-4 text-accent-foreground">
            <IconLink size={40} />
          </div>
          <p className="text-base font-semibold text-foreground">
            {t('no_links_title')}
          </p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Use the Quick Create form to shorten your first link.
          </p>
        </div>
      ) : filteredLinks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border px-6 py-12 text-center">
          <IconSearch size={40} className="mb-4 text-muted-foreground" />
          <p className="text-base font-semibold text-foreground">
            No results found
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a different search term.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLinks.map(shortlink => (
            <ShortlinkCard key={shortlink.id} shortlink={shortlink} />
          ))}
        </div>
      )}
    </div>
  );
}
