import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';
import { NonceProvider } from './utils/nonce';

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
