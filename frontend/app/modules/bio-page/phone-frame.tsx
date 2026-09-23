import type { PropsWithChildren } from 'react';

interface PhoneFrameProps {
  label?: string;
  className?: string;
  // Height of the screen area; the page inside scrolls when taller.
  screenClassName?: string;
}

// A dark device frame that reads as a phone in both light and dark themes.
export function PhoneFrame({
  children,
  label,
  className = '',
  screenClassName = 'h-[560px]',
}: PropsWithChildren<PhoneFrameProps>) {
  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      className={`relative mx-auto w-full max-w-[300px] rounded-[2.75rem] bg-neutral-900 p-[10px] shadow-[0_30px_60px_-15px_rgb(0_0_0/0.45)] ring-1 ring-white/10 ${className}`}
    >
      <div
        aria-hidden="true"
        className="absolute top-[18px] left-1/2 z-10 h-[22px] w-[90px] -translate-x-1/2 rounded-full bg-neutral-900"
      />
      <div
        className={`overflow-x-hidden overflow-y-auto rounded-[2.1rem] ${screenClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
