import { Layout } from '../../components/layout';
import { Box, Container, SimpleGrid } from '@mantine/core';
import { QuickCreate } from './modules/quick-create';
import { SummaryCard } from '~/components/summary-card';
import { useTranslation } from 'react-i18next';
import type { Route } from './+types';
import { useGetShortlinks } from 'packages/core/actions/get-shortlinks/get-shortlinks.hook';
import { useQuery } from '@tanstack/react-query';
import axios, { type AxiosResponse } from 'axios';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Dashboard' },
    { name: 'description', content: 'Create shareable links' },
  ];
}

export const ssr = false;

export default function Page() {
  const { t } = useTranslation('home');
  const { data, isLoading } = useGetShortlinks();

  return (
    <Layout.Main>
      <Container fluid>
        <SimpleGrid cols={{ base: 1, sm: 3, lg: 4 }} mb="md">
          <SummaryCard
            loading={isLoading}
            value={data?.total || 0}
            label={t('total_links')}
          />
        </SimpleGrid>
        <Box my="lg">
          <QuickCreate />
        </Box>
      </Container>
    </Layout.Main>
  );
}
