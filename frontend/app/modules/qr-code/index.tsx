import { ActionIcon, Button, CopyButton, Loader, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconQrcode,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { useGetQrCode } from '@internal/core/actions/get-qr-code/get-qr-code.hook';
import type { GetQrCodeParams } from '@internal/core/actions/get-qr-code/get-qr-code.types';
import { queryClient } from '@internal/core/service-provider';

interface QrCodeViewProps extends GetQrCodeParams {
  url: string;
  filename: string;
}

function QrCodeView({ resource, id, url, filename }: QrCodeViewProps) {
  const { t } = useTranslation('links');
  // Mantine modals render through a portal mounted above the
  // QueryClientProvider, so the client must be passed explicitly.
  const { data, isLoading, isError } = useGetQrCode(
    { resource, id },
    queryClient
  );
  const [objectUrl, setObjectUrl] = useState<string>();

  useEffect(() => {
    if (!data) return;
    const next = URL.createObjectURL(data);
    setObjectUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [data]);

  if (isError) {
    return (
      <p className="py-6 text-center text-sm text-destructive">
        {t('qr_failed')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5 pt-3 pb-1">
      <p className="text-center text-sm text-balance text-foreground/80">
        {t('qr_hint')}
      </p>

      {/* Always on white: QR readers need the contrast, in either theme. */}
      <div className="mx-auto flex size-60 items-center justify-center rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/10">
        {isLoading || !objectUrl ? (
          <Loader color="gray" />
        ) : (
          <img
            src={objectUrl}
            alt={t('qr_alt', { url })}
            className="size-full"
          />
        )}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/60 py-1.5 pr-1.5 pl-3">
        <span
          className="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground"
          title={url}
        >
          {url}
        </span>
        <CopyButton value={url} timeout={1500}>
          {({ copied, copy }) => (
            <Tooltip
              label={copied ? t('qr_copied') : t('qr_copy')}
              withArrow
              position="top"
              zIndex={1000}
            >
              <ActionIcon
                variant="subtle"
                color={copied ? 'green' : 'gray'}
                onClick={copy}
                aria-label={t('qr_copy')}
              >
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </div>

      <Button
        component="a"
        href={objectUrl}
        download={filename}
        disabled={!objectUrl}
        leftSection={<IconDownload size={16} />}
        color="brand"
        size="md"
        fullWidth
      >
        {t('qr_download')}
      </Button>
    </div>
  );
}

export function openQrCodeModal(props: QrCodeViewProps) {
  modals.open({
    title: (
      <span className="flex items-center gap-2 font-semibold text-foreground">
        <IconQrcode size={18} />
        {i18n.t('links:qr_code')}
      </span>
    ),
    centered: true,
    size: 'sm',
    padding: 'lg',
    children: <QrCodeView {...props} />,
  });
}
