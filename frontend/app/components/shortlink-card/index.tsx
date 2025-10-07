import { IconEdit, IconShare } from '@tabler/icons-react';
import {
  ActionIcon,
  Badge,
  Card,
  Group,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import classes from './shortlink-card.module.css';
import type { Shortlink } from '@internal/core/types/Shortlink';
import { useNavigate } from 'react-router';
import { useClipboard } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';

interface ShortLinkCardProps {
  loading?: boolean;
  link?: Shortlink;
}

export function ShortLinkCard({ link, loading = false }: ShortLinkCardProps) {
  const navigate = useNavigate();
  const { copy } = useClipboard({ timeout: 500 });

  function handleEdit() {
    if (link) navigate(`/links/${link.id}`);
  }

  function handleShare() {
    if (link) {
      notifications.show({
        message: 'Link copied to clipboard',
        color: 'green',
      });
      copy(link.short_url);
    }
  }

  return (
    <Card withBorder padding="lg" radius="md" className={classes.card}>
      {loading && <Skeleton height={20} mb="sm" radius="md" />}
      {
        <Badge color="green" variant={link?.title ? 'dot' : 'doutlineot'}>
          {link?.title || 'untitled'}
        </Badge>
      }

      <Stack mt="lg">
        {link && (
          <Text fz="xs" c="dimmed">
            Redirect to: {link.short_url}
          </Text>
        )}

        <div>
          {loading ? (
            <Skeleton height={20} mb="sm" radius="md" />
          ) : (
            <Text fz="xs" c="dimmed">
              Last visit: {link?.last_accessed_at || 'Never'}
            </Text>
          )}
        </div>
      </Stack>

      <Card.Section className={classes.footer}>
        <Group justify="space-between">
          {loading ? (
            <Skeleton height={20} mb="sm" radius="md" />
          ) : (
            <Text fz="xs" c="dimmed">
              Clicks: {link?.click_count || 0}
            </Text>
          )}
          {loading ? (
            <Skeleton height={20} mb="sm" radius="md" />
          ) : (
            <Group gap={0}>
              <ActionIcon variant="subtle" color="gray" onClick={handleEdit}>
                <IconEdit
                  size={20}
                  color="var(--mantine-color-blue-6)"
                  stroke={1.5}
                />
              </ActionIcon>
              <ActionIcon variant="subtle" color="gray" onClick={handleShare}>
                <IconShare
                  size={20}
                  color="var(--mantine-color-green-6)"
                  stroke={1.5}
                />
              </ActionIcon>
            </Group>
          )}
        </Group>
      </Card.Section>
    </Card>
  );
}
