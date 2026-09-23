import type { Icon } from '@tabler/icons-react';
import { Link } from 'react-router';

// A full-width button that matches Google's rendered "Sign in with Google" so
// the two sit together as equals: filled #202124 with the icon on a white
// tile in dark mode (Google's filled_black), white with a grey border in
// light mode (Google's outline). Same 40px height and 4px corners.
export function ProviderButton({
  to,
  icon: IconComponent,
  children,
}: {
  to: string;
  icon: Icon;
  children: string;
}) {
  return (
    <Link
      to={to}
      className="relative flex h-10 w-full items-center justify-center rounded-[4px] border border-[#747775] bg-white px-12 text-sm font-medium text-[#1f1f1f] transition-colors hover:bg-[#f2f2f2] dark:border-transparent dark:bg-[#202124] dark:text-[#e8eaed] dark:hover:bg-[#2b2c30]"
    >
      <span className="absolute inset-y-[1px] left-[1px] flex w-[38px] items-center justify-center rounded-l-[3px] dark:bg-white">
        <IconComponent size={18} stroke={1.9} className="text-[#1f1f1f]" />
      </span>
      {children}
    </Link>
  );
}
