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
    // TODO: Move this crap to backend
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
        <Loader size="lg" />
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          {t('loading_links')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
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
          styles={{
            input: {
              borderColor: 'var(--mantine-color-gray-3)',
              '&:focus': {
                borderColor: 'var(--mantine-color-blue-5)',
              },
            },
          }}
        />

        <Tooltip label={t('refresh_links') || 'Atualizar lista'}>
          <ActionIcon
            variant="light"
            color="blue"
            size="lg"
            onClick={handleRefresh}
            loading={isLoading}
          >
            <IconRefresh size={20} />
          </ActionIcon>
        </Tooltip>
      </div>

      {/* Lista de links filtrados */}
      {filteredLinks.length === 0 && links.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800/50 dark:to-blue-900/10 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
          <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
            <IconLink size={48} className="text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-base text-gray-700 dark:text-gray-300 font-semibold">
            {t('no_links_title')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-sm text-center">
            {t('no_links_description')}
          </p>
        </div>
      ) : filteredLinks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <IconSearch
            size={48}
            className="text-gray-400 dark:text-gray-500 mb-4"
          />
          <p className="text-base text-gray-700 dark:text-gray-300 font-semibold">
            {t('no_results_found') || 'Nenhum resultado encontrado'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
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
