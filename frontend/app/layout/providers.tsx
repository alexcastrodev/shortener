import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/notifications/styles.css';
import 'mantine-react-table/styles.css';
import '../i18n';

import { MantineProvider } from '@mantine/core';
import { ServiceProvider } from '@internal/core/service-provider';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import type { PropsWithChildren } from 'react';
import { mantineTheme } from '@internal/ui';

export function Providers({ children }: PropsWithChildren) {
  return (
    <MantineProvider theme={mantineTheme} defaultColorScheme="dark">
      <Notifications />
      <ModalsProvider>
        <ServiceProvider>{children}</ServiceProvider>
      </ModalsProvider>
    </MantineProvider>
  );
}
