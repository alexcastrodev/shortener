import { Layout } from '../../components/layout';
import { Box, Container, SimpleGrid } from '@mantine/core';
import { QuickCreate } from './modules/quick-create';
import { SummaryCard } from '~/components/summary-card';
import { useTranslation } from 'react-i18next';
import type { Route } from './+types';
import { useUserState } from '@internal/core/states/use-user-state';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Shortener' },
    { name: 'description', content: 'Create shareable links' },
  ];
}

export default function Page() {
  const { t } = useTranslation('home');
  const { user } = useUserState();

  return (
    <Layout.Main>
      <Container fluid>
        <SimpleGrid cols={{ base: 1, sm: 3, lg: 4 }} mb="md">
          {user && (
            <SummaryCard value={user?.shortlinks_count} label={t('total_links')} />
          )}
        </SimpleGrid>
        <Box my="lg">
          <QuickCreate />
        </Box>
      </Container>
    </Layout.Main>
  );
}
