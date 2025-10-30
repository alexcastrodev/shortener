import { ActionIcon, Menu, Badge, Text, Tooltip } from '@mantine/core';
import {
  IconCopy,
  IconDotsVertical,
  IconTrash,
  IconExternalLink,
  IconClick,
  IconShare,
  IconChartBar,
  IconAlertTriangle,
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
      className="group bg-zinc-900/50 border border-zinc-800 rounded-lg p-5 hover:shadow-lg hover:border-violet-600 transition-all duration-200 cursor-pointer backdrop-blur-xl"
      onClick={handleViewDetails}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white truncate mb-1">
              {shortlink.title || t('untitled')}
            </h3>
            <a
              href={shortlink.short_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-violet-400 hover:text-violet-300 text-sm font-medium hover:underline transition-colors inline-flex items-center gap-1"
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
                styles={{
                  root: {
                    color: '#a1a1aa',
                    '&:hover': {
                      backgroundColor: 'rgba(63, 63, 70, 0.5)',
                    },
                  },
                }}
              >
                <IconDotsVertical size={18} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown
              style={{
                backgroundColor: '#27272a',
                borderColor: '#3f3f46',
              }}
            >
              <Menu.Item
                leftSection={<IconShare size={16} />}
                onClick={handleShare}
                style={{ color: '#ffffff' }}
              >
                {t('copy_link')}
              </Menu.Item>
              <Menu.Divider style={{ borderColor: '#3f3f46' }} />
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

        <p className="text-zinc-400 truncate text-xs">
          {shortlink.original_url}
        </p>

        {!shortlink.is_active && (
          <div className="p-2 bg-red-900/30 border border-red-800 rounded text-xs flex items-center gap-2 text-red-300">
            <IconAlertTriangle size={14} />
            <span>{t('unsafe_shortlink_message')}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <div className="flex items-center gap-4">
            <Tooltip label="Click count">
              <Badge
                size="md"
                variant="light"
                leftSection={<IconClick size={14} />}
                styles={{
                  root: {
                    backgroundColor: 'rgba(124, 58, 237, 0.2)',
                    color: '#a78bfa',
                    borderColor: 'transparent',
                  },
                }}
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
            <p className="text-xs text-zinc-500">Last access</p>
            <span className="text-xs text-zinc-400">{formattedDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
