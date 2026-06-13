import { ActionIcon, Menu, Badge, Text, Tooltip } from '@mantine/core';
import {
  IconDotsVertical,
  IconTrash,
  IconExternalLink,
  IconClick,
  IconShare,
  IconAlertTriangle,
  IconPencil,
} from '@tabler/icons-react';
import type { Shortlink } from 'packages/core/types/Shortlink';
import { useNavigate } from 'react-router';
import { useClipboard } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useDeleteShortlink } from 'packages/core/actions/delete-shortlink/delete-shortlink.hook';
import { queryClient } from 'packages/core/service-provider';
import { getShortlinksKey } from 'packages/core/actions/get-shortlinks/get-shortlinks.hook';
import { useTranslation } from 'react-i18next';
import { EditShortlinkForm } from './edit-shortlink-form';

interface ShortlinkCardListItemProps {
  shortlink: Shortlink;
}

export function ShortlinkCard({ shortlink }: ShortlinkCardListItemProps) {
  const navigate = useNavigate();
  const { copy } = useClipboard({ timeout: 500 });
  const { t } = useTranslation('dashboard');

  const { mutate: deleteShortlink } = useDeleteShortlink({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getShortlinksKey });
      notifications.show({
        message: t('shortlink_deleted'),
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: t('error_title'),
        message: t('error_message'),
        color: 'red',
      });
    },
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formattedDate = shortlink.last_accessed_at
    ? formatDate(shortlink.last_accessed_at)
    : t('never_accessed');

  const handleViewDetails = () => {
    navigate(`/app/links/${shortlink.id}`);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    notifications.show({
      message: t('link_copied'),
      color: 'green',
    });
    copy(shortlink.short_url);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    const modalId = `edit-shortlink-${shortlink.id}`;
    modals.open({
      modalId,
      title: t('edit_link'),
      centered: true,
      children: <EditShortlinkForm shortlink={shortlink} modalId={modalId} />,
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    modals.openConfirmModal({
      title: t('delete_confirm_title'),
      centered: true,
      children: <Text size="sm">{t('delete_confirm_message')}</Text>,
      labels: {
        confirm: t('delete_confirm_button'),
        cancel: t('delete_cancel_button'),
      },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteShortlink(shortlink.id.toString()),
    });
  };

  return (
    <div
      className="group cursor-pointer rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm transition-colors hover:border-primary/40"
      onClick={handleViewDetails}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="mb-1 truncate text-base font-semibold text-foreground">
              {shortlink.title || t('untitled')}
            </h3>
            <a
              href={shortlink.short_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:underline"
            >
              {shortlink.short_url}
              <IconExternalLink size={12} />
            </a>
          </div>

          <Menu position="bottom-end" shadow="md" withinPortal>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                size="md"
                onClick={e => e.stopPropagation()}
                color="gray"
              >
                <IconDotsVertical size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconShare size={16} />}
                onClick={handleShare}
              >
                {t('copy_link')}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconPencil size={16} />}
                onClick={handleEdit}
              >
                {t('edit_link')}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={handleDelete}
              >
                {t('delete')}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>

        <p className="truncate text-xs text-muted-foreground">
          {shortlink.original_url}
        </p>

        {!shortlink.is_active && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            <IconAlertTriangle size={14} />
            <span>
              {shortlink.inactive_at && shortlink.safe
                ? t('inactive_shortlink_message')
                : t('unsafe_shortlink_message')}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border pt-2">
          <div className="flex items-center gap-4">
            <Tooltip label="Click count">
              <Badge
                size="md"
                variant="light"
                color="brand"
                leftSection={<IconClick size={14} />}
              >
                {shortlink.events_count}
              </Badge>
            </Tooltip>

            {shortlink.created_by_guest && (
              <Tooltip label="This shortlink generated on the homepage without Authentication">
                <Badge size="sm" variant="dot" color="yellow">
                  Guest
                </Badge>
              </Tooltip>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Last access</p>
            <span className="text-xs text-muted-foreground">
              {formattedDate}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
