import { useRef, useState } from 'react';
import { GoogleLogo, ProviderButton } from './provider-button';

// "Continue with Google" drawn by us, so it always matches the other sign-in
// options (Google's rendered button restyles itself per visitor). Clicking
// opens Google's popup through Google Identity Services (authorization code
// flow); the one-time code goes to the API, which exchanges it for the ID
// token (backend/app/services/google_sign_in.rb). Without
// VITE_GOOGLE_CLIENT_ID nothing renders.

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  string | undefined;
const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

interface CodeClient {
  requestCode: () => void;
}

interface GoogleOAuthApi {
  initCodeClient: (options: Record<string, unknown>) => CodeClient;
}

declare global {
  interface Window {
    google?: { accounts: { oauth2?: GoogleOAuthApi } };
  }
}

let scriptPromise: Promise<GoogleOAuthApi> | undefined;

function loadGoogle(): Promise<GoogleOAuthApi> {
  const ready = () => window.google?.accounts?.oauth2;
  if (ready()) return Promise.resolve(ready()!);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      ready() ? resolve(ready()!) : reject(new Error('google'));
    script.onerror = () => {
      scriptPromise = undefined;
      reject(new Error('google'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function GoogleButton({
  onCode,
  pending = false,
}: {
  onCode: (code: string) => void;
  pending?: boolean;
}) {
  const [opening, setOpening] = useState(false);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  if (!GOOGLE_CLIENT_ID) return null;

  async function open() {
    setOpening(true);
    try {
      const oauth2 = await loadGoogle();
      oauth2
        .initCodeClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email',
          ux_mode: 'popup',
          callback: (response: { code?: string }) => {
            setOpening(false);
            if (response.code) onCodeRef.current(response.code);
          },
          // Closing the popup or blocking it lands here.
          error_callback: () => setOpening(false),
        })
        .requestCode();
    } catch {
      setOpening(false);
    }
  }

  return (
    <ProviderButton
      icon={<GoogleLogo />}
      onClick={open}
      loading={opening || pending}
    >
      Continue with Google
    </ProviderButton>
  );
}
