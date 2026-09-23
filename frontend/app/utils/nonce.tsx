import { createContext, useContext } from 'react';

// Per-request CSP nonce, provided by entry.server. On the client it is
// undefined: browsers hide nonce values from the DOM after parsing anyway.
const NonceContext = createContext<string | undefined>(undefined);

export const NonceProvider = NonceContext.Provider;

export function useNonce() {
  return useContext(NonceContext);
}
