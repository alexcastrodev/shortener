import { Layout } from '../components/layout';
import { Container, SimpleGrid } from '@mantine/core';
import type { Route } from '../+types/root';
import { ShortLinkCard } from '~/components/shortlink-card';
import { useGetShortlinks } from '@internal/core/actions/get-shortlinks/get-shortlinks.hook';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Links - Shortener' },
    { name: 'description', content: 'Show all links' },
  ];
}

export const ssr = false;

export default function Page() {
  const { data, isLoading } = useGetShortlinks();
  const shortlinks = data?.shortlink || [];

  return (
    <Layout.Main>
      <Container fluid>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg" mb="xl">
          {isLoading ? (
            <ShortLinkCard loading />
          ) : (
            shortlinks.map(link => <ShortLinkCard key={link.id} link={link} />)
          )}
        </SimpleGrid>
      </Container>
    </Layout.Main>
  );
}
