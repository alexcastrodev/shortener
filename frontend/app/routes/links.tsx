import { Layout } from '../components/layout';
import { Container, SimpleGrid } from '@mantine/core';
import { QuickCreate } from '~/routes/home/modules/quick-create';
import { SummaryCard } from '~/components/summary-card';
import { useTranslation, withTranslation } from 'react-i18next';
import type { Route } from '../+types/root';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Links - Shortener' },
    { name: 'description', content: 'Show all links' },
  ];
}

function Page() {
  const { t } = useTranslation('home');

  return (
    <Layout.Main>
      <Container fluid>
        <SimpleGrid cols={2}>
          <SummaryCard value={1} label={t('total_links')} />
        </SimpleGrid>
        <QuickCreate />
      </Container>
    </Layout.Main>
  );
}

export default withTranslation(['home'])(Page);
