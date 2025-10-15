import { SimpleGrid, Skeleton } from '@mantine/core';
import { useGetShortlinks } from '@internal/core/actions/get-shortlinks/get-shortlinks.hook';
import { ShortlinkCard } from '~/components/shortlink-card';

export function ShortLinkListingModule() {
  const { data, isLoading } = useGetShortlinks();
  const shortlinks = data?.shortlink || [];

  function getCols() {
    if (shortlinks.length >= 6) return { base: 1, sm: 2, md: 3, lg: 4 };
    if (shortlinks.length === 5) return { base: 1, sm: 2, md: 3 };
    if (shortlinks.length === 4) return { base: 1, sm: 2 };
    return { base: 1, sm: 2 };
  }

  return (
    <SimpleGrid cols={getCols()} spacing="lg" mb="xl">
      {isLoading ? (
        <Skeleton height={100} radius="md" />
      ) : (
        shortlinks.map(link => <ShortlinkCard key={link.id} shortlink={link} />)
      )}
    </SimpleGrid>
  );
}
