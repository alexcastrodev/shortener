import { Layout } from '../components/layout';
import {
  Container,
  Table,
  Text,
  Anchor,
  Group,
  ActionIcon,
  Tooltip,
  SimpleGrid,
} from '@mantine/core';
import { IconCopy } from '@tabler/icons-react';
import type { Route } from '../+types/root';
import { useGetShortlinks } from '@internal/core/actions/get-shortlinks/get-shortlinks.hook';
import { ShortLinkCard } from '~/components/shortlink-card';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Links - Shortener' },
    { name: 'description', content: 'Show all links' },
  ];
}

export default function Page() {
  const { data: shortlinks = [], isLoading } = useGetShortlinks();
  return (
    <Layout.Main>
      <Container fluid>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg" mb="xl">
          {isLoading ? (
            <ShortLinkCard loading />
          ) : (
            (shortlinks || []).map(link => (
              <ShortLinkCard key={link.id} link={link} />
            ))
          )}
        </SimpleGrid>
      </Container>
    </Layout.Main>
  );
}
