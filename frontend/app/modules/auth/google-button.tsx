import { useComputedColorScheme } from '@mantine/core';
import { useEffect, useRef } from 'react';

// "Sign in with Google" through Google Identity Services. Google renders the
// button itself (its branding rules) and hands back an ID token, which the
// API verifies (backend/app/services/google_sign_in.rb). Without
// VITE_GOOGLE_CLIENT_ID nothing renders.

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  string | undefined;
const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

interface GoogleIdApi {
  initialize: (options: Record<string, unknown>) => void;
  renderButton: (
    element: HTMLElement,
    options: Record<string, unknown>
  ) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

let scriptPromise: Promise<GoogleIdApi> | undefined;

function loadGoogle(): Promise<GoogleIdApi> {
  if (window.google?.accounts?.id)
    return Promise.resolve(window.google.accounts.id);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.google?.accounts?.id
        ? resolve(window.google.accounts.id)
        : reject(new Error('google'));
    script.onerror = () => {
      scriptPromise = undefined;
      reject(new Error('google'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function GoogleButton({
  text = 'continue_with',
  onCredential,
}: {
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  onCredential: (credential: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;
  const scheme = useComputedColorScheme('dark');

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !container.current) return;
    let cancelled = false;

    loadGoogle()
      .then(google => {
        const element = container.current;
        if (cancelled || !element) return;
        google.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: { credential?: string }) => {
            if (response.credential)
              onCredentialRef.current(response.credential);
          },
          ux_mode: 'popup',
          auto_select: false,
          use_fedcm_for_button: true,
        });
        element.replaceChildren();
        google.renderButton(element, {
          type: 'standard',
          theme: scheme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'rectangular',
          text,
          logo_alignment: 'left',
          // Same language as the rest of the site, not the browser's.
          locale: 'en',
          width: Math.min(element.offsetWidth || 348, 400),
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [scheme, text]);

  if (!GOOGLE_CLIENT_ID) return null;
  return (
    <div ref={container} className="flex min-h-10 w-full justify-center" />
  );
}
