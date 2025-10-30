import type { PropsWithChildren } from 'react';

export function Main({ children }: PropsWithChildren) {
  return (
    <main className="flex-1 w-full overflow-auto bg-gradient-to-br from-black via-gray-900 to-black relative">
      {/* Background Effects - Same as dashboard */}
      <div className="fixed inset-0 opacity-10 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(124,58,237,0.3) 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="fixed inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/50 pointer-events-none" />

      <div className="relative z-10">{children}</div>
    </main>
  );
}
