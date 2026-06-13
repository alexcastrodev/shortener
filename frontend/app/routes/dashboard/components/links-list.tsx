import { useState, useMemo } from 'react';
import { Loader, TextInput, ActionIcon, Tooltip } from '@mantine/core';
import { IconLink, IconSearch, IconRefresh, IconX } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { ShortlinkCard } from '~/components/shortlink-card';
import type { Shortlink } from 'packages/core/types/Shortlink';
import { useTranslation } from 'react-i18next';
import { getShortlinksKey } from 'packages/core/actions/get-shortlinks/get-shortlinks.hook';

interface LinksListProps {
  links: Shortlink[];
  isLoading: boolean;
}

export function LinksList({ links, isLoading }: LinksListProps) {
  const { t } = useTranslation('dashboard');
  const queryClient = useQueryClient();
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

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getShortlinksKey });
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

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
      <div className="flex items-center gap-2">
        <TextInput
          placeholder={
            t('search_links_placeholder') ||
            'Buscar por título, link ou código...'
          }
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
          rightSection={
            searchQuery && (
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={handleClearSearch}
                size="sm"
              >
                <IconX size={16} />
              </ActionIcon>
            )
          }
          className="flex-1"
        />

        <Tooltip label={t('refresh_links') || 'Atualizar lista'}>
          <ActionIcon
            variant="light"
            size="lg"
            onClick={handleRefresh}
            loading={isLoading}
            color="brand"
          >
            <IconRefresh size={20} />
          </ActionIcon>
        </Tooltip>
      </div>

      {filteredLinks.length === 0 && links.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="mb-4 rounded-lg bg-accent p-4 text-accent-foreground">
            <IconLink size={40} />
          </div>
          <p className="text-base font-semibold text-foreground">
            {t('no_links_title')}
          </p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {t('no_links_description')}
          </p>
        </div>
      ) : filteredLinks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card px-6 py-12 text-center">
          <IconSearch size={40} className="mb-4 text-muted-foreground" />
          <p className="text-base font-semibold text-foreground">
            {t('no_results_found') || 'Nenhum resultado encontrado'}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('try_different_search') || 'Tente uma busca diferente'}
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
