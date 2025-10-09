import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/notifications/styles.css';
import '../i18n';

import { MantineProvider } from '@mantine/core';
import { ServiceProvider } from '@internal/core/service-provider';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import type { PropsWithChildren } from 'react';

export function Providers({ children }: PropsWithChildren) {
  return (
    <MantineProvider defaultColorScheme="dark">
      <Notifications />
      <ModalsProvider>
        <ServiceProvider>{children}</ServiceProvider>
      </ModalsProvider>
    </MantineProvider>
  );
}
