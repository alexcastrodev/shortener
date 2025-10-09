import { IconEdit, IconShare, IconTrash } from '@tabler/icons-react';
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
import { modals } from '@mantine/modals';
import { useDeleteShortlink } from '@internal/core/actions/delete-shortlink/delete-shortlink.hook';
import { queryClient } from '@internal/core/service-provider';
import { getShortlinksKey } from '@internal/core/actions/get-shortlinks/get-shortlinks.hook';

interface ShortLinkCardProps {
  loading?: boolean;
  link?: Shortlink;
}

export function ShortLinkCard({ link, loading = false }: ShortLinkCardProps) {
  const navigate = useNavigate();
  const { copy } = useClipboard({ timeout: 500 });
  const { mutate: deleteShortlink } = useDeleteShortlink({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getShortlinksKey });
      notifications.show({
        message: 'Shortlink deleted',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Something went wrong, please try again later.',
        color: 'red',
      });
    },
  });

  function handleEdit(e: React.MouseEvent) {
    if (link) navigate(`/app/links/${link.id}`);
  }

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    if (link) {
      notifications.show({
        message: 'Link copied to clipboard',
        color: 'green',
      });
      copy(link.short_url);
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();  
    modals.openConfirmModal({
      title: 'Delete shortlink',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete this shortlink? This action is
          destructive and you will have to create a new link.
        </Text>
      ),
      labels: { confirm: 'Delete shortlink', cancel: "No don't delete it" },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteShortlink(link?.id || ''),
    });
  }

  return (
    <Card withBorder padding="lg" radius="md" className={classes.card} onClick={handleEdit}>
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
              Clicks: {link?.events_count || 0}
            </Text>
          )}
          {loading ? (
            <Skeleton height={20} mb="sm" radius="md" />
          ) : (
            <Group gap={0}>
              <ActionIcon
                component="button"
                variant="subtle"
                color="gray"
                onClick={handleDelete}
              >
                <IconTrash
                  size={20}
                  color="var(--mantine-color-red-6)"
                  stroke={1.5}
                />
              </ActionIcon>
              <ActionIcon
                component="button"
                variant="subtle"
                color="gray"
                onClick={handleEdit}
              >
                <IconEdit
                  size={20}
                  color="var(--mantine-color-blue-6)"
                  stroke={1.5}
                />
              </ActionIcon>
              <ActionIcon
                component="button"
                variant="subtle"
                color="gray"
                onClick={handleShare}
              >
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
