import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';
import i18n from './i18n';
import { browserLocale } from './i18n/use-locale-sync';
import { NonceProvider } from './utils/nonce';

await i18n.loadLanguages(browserLocale());

// entry.server wraps the app in NonceProvider; the client tree must have the
// same shape, or ids generated with useId (Mantine menus, inputs) stop
// matching between server and client and those components break.
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <NonceProvider value={undefined}>
        <HydratedRouter />
      </NonceProvider>
    </StrictMode>
  );
});
