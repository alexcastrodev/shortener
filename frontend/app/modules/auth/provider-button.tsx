import type { ReactNode } from 'react';
import { Loader } from '@mantine/core';
import { Link } from 'react-router';

// A full-width sign-in option: filled #202124 with the icon on a white tile in
// dark mode, white with a grey border in light mode (the look of Google's
// sign-in buttons). Used for "Continue with Google" and "Sign up with email"
// so they always match. The type is !important because Mantine's global reset
// (unlayered) sets every <button>'s font and would beat the utilities.
const CLASSES =
  'relative flex h-10 w-full items-center justify-center rounded-[4px] border border-[#747775] bg-white px-12 text-sm/5! font-medium! text-[#1f1f1f] transition-colors hover:bg-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-60 dark:border-transparent dark:bg-[#202124] dark:text-[#e8eaed] dark:hover:bg-[#2b2c30]';

type Props = { icon: ReactNode; children: string; loading?: boolean } & (
  | { to: string; onClick?: never; disabled?: never }
  | { to?: never; onClick: () => void; disabled?: boolean }
);

export function ProviderButton({ icon, children, loading, ...action }: Props) {
  const content = (
    <>
      <span className="absolute inset-y-[1px] left-[1px] flex w-[38px] items-center justify-center rounded-l-[3px] dark:bg-white">
        {loading ? <Loader size={16} color="gray" /> : icon}
      </span>
      {children}
    </>
  );

  if (action.to) {
    return (
      <Link to={action.to} className={CLASSES}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={CLASSES}
      onClick={action.onClick}
      disabled={action.disabled || loading}
    >
      {content}
    </button>
  );
}

// Google's "G", as its sign-in branding guidelines require.
export function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
