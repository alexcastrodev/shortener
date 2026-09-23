import { Button, Loader } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconDownload } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useGetQrCode } from '@internal/core/actions/get-qr-code/get-qr-code.hook';
import type { GetQrCodeParams } from '@internal/core/actions/get-qr-code/get-qr-code.types';
import { queryClient } from '@internal/core/service-provider';

interface QrCodeViewProps extends GetQrCodeParams {
  url: string;
  filename: string;
}

function QrCodeView({ resource, id, url, filename }: QrCodeViewProps) {
  // Mantine modals render through a portal mounted above the
  // QueryClientProvider, so the client must be passed explicitly.
  const { data, isLoading, isError } = useGetQrCode({ resource, id }, queryClient);
  const [objectUrl, setObjectUrl] = useState<string>();

  useEffect(() => {
    if (!data) return;
    const next = URL.createObjectURL(data);
    setObjectUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [data]);

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Could not generate the QR code. Please try again.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-64 w-64 items-center justify-center rounded-lg bg-white p-2">
        {isLoading || !objectUrl ? (
          <Loader />
        ) : (
          <img src={objectUrl} alt={`QR code for ${url}`} className="h-full w-full" />
        )}
      </div>
      <p className="break-all text-center text-sm text-muted-foreground">{url}</p>
      <Button
        component="a"
        href={objectUrl}
        download={filename}
        disabled={!objectUrl}
        leftSection={<IconDownload size={16} />}
        color="brand"
        fullWidth
      >
        Download SVG
      </Button>
    </div>
  );
}

export function openQrCodeModal(props: QrCodeViewProps) {
  modals.open({
    title: 'QR code',
    centered: true,
    children: <QrCodeView {...props} />,
  });
}
