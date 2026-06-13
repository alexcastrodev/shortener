import type { PropsWithChildren } from 'react';

export function Main({ children }: PropsWithChildren) {
  return (
    <main className="min-h-[calc(100vh-65px)] flex-1 bg-background text-foreground">
      {children}
    </main>
  );
}
