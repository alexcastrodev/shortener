import { ActionIcon, Menu, Badge, Text, Button } from '@mantine/core';
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
    <div className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200">
      <div className="space-y-4">
        {/* Header with title and actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate mb-2">
              {shortlink.title || t('untitled')}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={shortlink.short_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium hover:underline transition-colors"
              >
                {shortlink.short_url}
              </a>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                onClick={handleShare}
                className="hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <IconCopy size={16} />
              </ActionIcon>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="light"
              size="sm"
              leftSection={<IconChartBar size={16} />}
              onClick={handleViewDetails}
            >
              {t('view_details')}
            </Button>

            <Menu position="bottom-end" shadow="md" withinPortal>
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="md"
                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
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
        </div>

        <div className="flex items-center gap-2 text-sm">
          <IconExternalLink
            size={14}
            className="text-gray-400 dark:text-gray-500 shrink-0"
          />
          <p className="text-gray-600 dark:text-gray-400 truncate text-xs break-all">
            {shortlink.original_url}
          </p>
        </div>
        {!shortlink.is_active && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded text-sm flex items-center gap-3">
            <IconAlertTriangle size={14} />
            <span>{t('unsafe_shortlink_message')}</span>
          </div>
        )}

        <div className="border-t border-gray-100 dark:border-gray-700"></div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t('clicks')}
            </span>
            <Badge
              size="lg"
              variant="light"
              color="blue"
              leftSection={<IconClick size={14} />}
              className="font-semibold"
            >
              {shortlink.events_count}
            </Badge>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t('last_accessed')}
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {formattedDate}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
